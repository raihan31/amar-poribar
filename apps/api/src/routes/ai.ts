import { createHash } from "node:crypto";
import { and, desc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { AiUnavailableError, askQuestion, monthlySummary, parseInput, type AskTools, type SummaryInput } from "@amar-poribar/ai";
import {
  AskRequestSchema,
  ParseRequestSchema,
  SummaryQuerySchema,
  type MonthlyAiSummary,
  type ParseResponse,
} from "@amar-poribar/shared";
import type { AppDeps } from "../app.js";
import { requireRole } from "../auth.js";
import type { Db } from "../db/client.js";
import { aiSummaries, aiUsage, categories, families, transactions } from "../db/schema.js";
import { HttpError, parseOr400 } from "../errors.js";
import { currentDhakaMonth, monthRange, previousMonth } from "../month.js";
import { monthTotals } from "../totals.js";

type FamilyParams = { Params: { familyId: string } };

/** Monthly AI quota per family (FR-AI-12). Deterministic paths (SMS parser, template summary) are free. */
async function hasAiQuota(db: Db, familyId: string): Promise<boolean> {
  const month = currentDhakaMonth();
  const [family] = await db.select({ quota: families.aiQuotaMonth }).from(families).where(eq(families.id, familyId));
  const [usage] = await db.select({ requests: aiUsage.requests }).from(aiUsage)
    .where(and(eq(aiUsage.familyId, familyId), eq(aiUsage.month, month)));
  return (family?.quota ?? 0) > (usage?.requests ?? 0);
}

async function recordAiUse(db: Db, familyId: string): Promise<void> {
  await db.insert(aiUsage).values({ familyId, month: currentDhakaMonth(), requests: 1 })
    .onConflictDoUpdate({ target: [aiUsage.familyId, aiUsage.month], set: { requests: sql`${aiUsage.requests} + 1` } });
}

export async function aiRoutes(app: FastifyInstance, { db, anthropic, aiModel }: AppDeps) {
  app.addHook("preHandler", app.authenticate);

  /** Text, voice transcript or MFS SMS → drafts (FR-AI-01, FR-AI-02, FR-VOICE-02). */
  app.post<FamilyParams>("/v1/families/:familyId/ai/parse", async (req): Promise<ParseResponse> => {
    const { familyId } = req.params;
    await requireRole(db, familyId, req.user.sub, "member");
    const { text, now } = parseOr400(ParseRequestSchema, req.body);

    const cats = await db
      .select({ key: categories.key, nameEn: categories.nameEn, nameBn: categories.nameBn, kind: categories.kind })
      .from(categories)
      .where(and(eq(categories.familyId, familyId), eq(categories.isHidden, false)));

    try {
      const result = await parseInput(text, {
        categories: cats,
        now: now ? new Date(now) : new Date(),
        client: (await hasAiQuota(db, familyId)) ? anthropic : undefined,
        model: aiModel,
      });
      if (result.usedAi) await recordAiUse(db, familyId);
      return result;
    } catch (err) {
      if (err instanceof AiUnavailableError) throw new HttpError(503, "ai_unavailable", "AI couldn't read that; please enter it manually");
      throw err;
    }
  });

  /** Plain-language monthly summary, with a separate version for text-to-speech (FR-AI-11, FR-VOICE-04). */
  app.get<FamilyParams>("/v1/families/:familyId/ai/summary", async (req): Promise<MonthlyAiSummary> => {
    const { familyId } = req.params;
    await requireRole(db, familyId, req.user.sub, "viewer");
    const { month = currentDhakaMonth(), locale } = parseOr400(SummaryQuerySchema, req.query);

    const [current, last] = await Promise.all([
      monthTotals(db, familyId, req.user.sub, month),
      monthTotals(db, familyId, req.user.sub, previousMonth(month)),
    ]);
    const lastByCategory = new Map(last.byCategory.map((c) => [c.categoryId, c.totalPaisa]));
    const input: SummaryInput = {
      month,
      locale,
      expensePaisa: current.expensePaisa,
      incomePaisa: current.incomePaisa,
      lastMonthExpensePaisa: last.expensePaisa,
      categories: current.byCategory.map((c) => ({
        name: locale === "bn" ? c.name : c.nameEn,
        paisa: c.totalPaisa,
        lastMonthPaisa: lastByCategory.get(c.categoryId) ?? 0,
      })),
    };

    // Same numbers → same summary. Only aggregates are hashed and sent to the AI, never notes or names.
    const factsHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const [cached] = await db.select().from(aiSummaries).where(and(
      eq(aiSummaries.familyId, familyId), eq(aiSummaries.month, month),
      eq(aiSummaries.locale, locale), eq(aiSummaries.factsHash, factsHash),
    ));
    if (cached) return { month, locale, text: cached.text, speechText: cached.speechText, usedAi: cached.usedAi };

    const useAi = anthropic && (await hasAiQuota(db, familyId));
    const summary = await monthlySummary(input, { client: useAi ? anthropic : undefined, model: aiModel });
    // Only AI summaries are cached; the template is free to rebuild and shouldn't block a later AI version.
    if (summary.usedAi) {
      await recordAiUse(db, familyId);
      await db.insert(aiSummaries)
        .values({ familyId, month, locale, factsHash, text: summary.text, speechText: summary.speechText, usedAi: true })
        .onConflictDoNothing();
    }
    return { month, locale, ...summary };
  });
  /** Ask a question about the family's data, typed or spoken (FR-AI-10, FR-VOICE-08). */
  app.post<FamilyParams>("/v1/families/:familyId/ai/ask", async (req) => {
    const { familyId } = req.params;
    // Members and above: viewers are summary-only (FR-FAM-05), and Ask can read individual entries.
    await requireRole(db, familyId, req.user.sub, "member");
    const { question, forSpeech } = parseOr400(AskRequestSchema, req.body);
    if (!anthropic) throw new HttpError(503, "ai_unavailable", "Ask is not available right now");
    if (!(await hasAiQuota(db, familyId))) throw new HttpError(429, "ai_quota", "This month's AI limit has been reached");

    const userId = req.user.sub;
    const tools: AskTools = {
      sumByCategory: async (month) =>
        (await monthTotals(db, familyId, userId, month)).byCategory.map((c) => ({ name: `${c.nameEn} / ${c.name}`, totalPaisa: c.totalPaisa })),
      compareMonths: async (a, b) => {
        const [ta, tb] = await Promise.all([monthTotals(db, familyId, userId, a), monthTotals(db, familyId, userId, b)]);
        return {
          a: { month: a, incomePaisa: ta.incomePaisa, expensePaisa: ta.expensePaisa },
          b: { month: b, incomePaisa: tb.incomePaisa, expensePaisa: tb.expensePaisa },
        };
      },
      listTransactions: async ({ month, categoryName, limit }) => {
        const { start, end } = monthRange(month);
        const rows = await db
          .select({ t: transactions, nameEn: categories.nameEn, nameBn: categories.nameBn })
          .from(transactions)
          .leftJoin(categories, eq(categories.id, transactions.categoryId))
          .where(and(
            eq(transactions.familyId, familyId),
            isNull(transactions.deletedAt),
            gte(transactions.occurredAt, start),
            lt(transactions.occurredAt, end),
            // Same visibility rule as the app: other members' private entries are never read (FR-TXN-05).
            or(eq(transactions.isPrivate, false), eq(transactions.createdBy, userId)),
          ))
          .orderBy(desc(transactions.occurredAt))
          .limit(200);
        return rows
          .filter((r) => !categoryName || [r.nameEn, r.nameBn, `${r.nameEn} / ${r.nameBn}`].includes(categoryName))
          .slice(0, limit)
          .map((r) => ({
            date: r.t.occurredAt.toISOString().slice(0, 10),
            type: r.t.type,
            amountPaisa: r.t.amountPaisa,
            category: r.nameEn,
            note: r.t.note,
            counterparty: r.t.counterparty,
          }));
      },
    };

    try {
      const answer = await askQuestion(question, {
        client: anthropic,
        tools,
        today: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date()),
        model: aiModel,
        forSpeech,
      });
      await recordAiUse(db, familyId);
      return { answer, usedAi: true };
    } catch (err) {
      if (err instanceof AiUnavailableError) throw new HttpError(503, "ai_unavailable", "AI couldn't answer that right now");
      throw err;
    }
  });
}
