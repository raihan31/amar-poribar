import { and, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { AiUnavailableError, parseInput } from "@amar-poribar/ai";
import { ParseRequestSchema, type ParseResponse } from "@amar-poribar/shared";
import type { AppDeps } from "../app.js";
import { requireRole } from "../auth.js";
import { aiUsage, categories, families } from "../db/schema.js";
import { HttpError, parseOr400 } from "../errors.js";
import { currentDhakaMonth } from "../month.js";

type FamilyParams = { Params: { familyId: string } };

export async function aiRoutes(app: FastifyInstance, { db, anthropic, aiModel }: AppDeps) {
  app.addHook("preHandler", app.authenticate);

  app.post<FamilyParams>("/v1/families/:familyId/ai/parse", async (req): Promise<ParseResponse> => {
    const { familyId } = req.params;
    await requireRole(db, familyId, req.user.sub, "member");
    const { text, now } = parseOr400(ParseRequestSchema, req.body);

    const cats = await db
      .select({ key: categories.key, nameEn: categories.nameEn, nameBn: categories.nameBn, kind: categories.kind })
      .from(categories)
      .where(and(eq(categories.familyId, familyId), eq(categories.isHidden, false)));

    // Check the monthly AI quota (FR-AI-12). The SMS parser is free and skips the quota.
    const month = currentDhakaMonth();
    const [family] = await db.select({ quota: families.aiQuotaMonth }).from(families).where(eq(families.id, familyId));
    const [usage] = await db.select({ requests: aiUsage.requests }).from(aiUsage)
      .where(and(eq(aiUsage.familyId, familyId), eq(aiUsage.month, month)));
    const quotaLeft = (family?.quota ?? 0) > (usage?.requests ?? 0);

    try {
      const result = await parseInput(text, {
        categories: cats,
        now: now ? new Date(now) : new Date(),
        client: quotaLeft ? anthropic : undefined,
        model: aiModel,
      });
      if (result.usedAi) {
        await db.insert(aiUsage).values({ familyId, month, requests: 1 })
          .onConflictDoUpdate({ target: [aiUsage.familyId, aiUsage.month], set: { requests: sql`${aiUsage.requests} + 1` } });
      }
      return result;
    } catch (err) {
      if (err instanceof AiUnavailableError) throw new HttpError(503, "ai_unavailable", "AI couldn't read that; please enter it manually");
      throw err;
    }
  });
}
