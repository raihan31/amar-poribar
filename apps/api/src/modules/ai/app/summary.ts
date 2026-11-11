import { createHash } from "node:crypto";
import { monthlySummary, type SummaryInput } from "@amar-poribar/ai";
import type { MonthlyAiSummary } from "@amar-poribar/shared";
import { previousMonth } from "../../ledger/index.js";
import type { AiDeps } from "./deps.js";
import { hasAiQuota, recordAiUse } from "./quota.js";

/** Plain-language monthly summary, with a separate version for text-to-speech (FR-AI-11, FR-VOICE-04). */
export async function summary(
  deps: AiDeps,
  input: { familyId: string; userId: string; month: string; locale: "bn" | "en" },
): Promise<MonthlyAiSummary> {
  const { familyId, userId, month, locale } = input;
  const [current, last] = await Promise.all([
    deps.ledger.getMonthTotals(familyId, { userId }, month),
    deps.ledger.getMonthTotals(familyId, { userId }, previousMonth(month)),
  ]);
  const lastByCategory = new Map(last.byCategory.map((c) => [c.categoryId, c.totalPaisa]));
  const facts: SummaryInput = {
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
  const key = {
    familyId,
    month,
    locale,
    factsHash: createHash("sha256").update(JSON.stringify(facts)).digest("hex"),
  };
  const cached = await deps.store.findSummary(key);
  if (cached) return { month, locale, text: cached.text, speechText: cached.speechText, usedAi: cached.usedAi };

  const useAi = deps.claude.enabled && (await hasAiQuota(deps, familyId));
  const result = await monthlySummary(facts, {
    client: useAi ? deps.claude.client : undefined,
    model: deps.claude.model,
  });
  // Only AI summaries are cached; the template is free to rebuild and shouldn't block a later AI version.
  if (result.usedAi) {
    await recordAiUse(deps, familyId);
    await deps.store.saveSummary(key, { text: result.text, speechText: result.speechText, usedAi: true });
  }
  return { month, locale, ...result };
}
