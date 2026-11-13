import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import type { AiStore } from "../app/deps.js";
import { aiSummaries, aiUsage } from "../schema.js";

export function createAiStore(db: Db): AiStore {
  return {
    async requestsUsed(familyId, month) {
      const [row] = await db
        .select({ requests: sql<number>`coalesce(sum(${aiUsage.requests}), 0)::int` })
        .from(aiUsage)
        .where(and(eq(aiUsage.familyId, familyId), eq(aiUsage.month, month)));
      return row?.requests ?? 0;
    },
    async recordMetering(familyId, month, feature, d) {
      await db
        .insert(aiUsage)
        .values({
          familyId,
          month,
          feature,
          requests: d.requests,
          inputTokens: d.inputTokens,
          outputTokens: d.outputTokens,
          latencyMsSum: d.latencyMsSum,
          errors: d.errors,
        })
        .onConflictDoUpdate({
          target: [aiUsage.familyId, aiUsage.month, aiUsage.feature],
          set: {
            requests: sql`${aiUsage.requests} + ${d.requests}`,
            inputTokens: sql`${aiUsage.inputTokens} + ${d.inputTokens}`,
            outputTokens: sql`${aiUsage.outputTokens} + ${d.outputTokens}`,
            latencyMsSum: sql`${aiUsage.latencyMsSum} + ${d.latencyMsSum}`,
            errors: sql`${aiUsage.errors} + ${d.errors}`,
          },
        });
    },
    async findSummary(key) {
      const [row] = await db
        .select()
        .from(aiSummaries)
        .where(
          and(
            eq(aiSummaries.familyId, key.familyId),
            eq(aiSummaries.month, key.month),
            eq(aiSummaries.locale, key.locale),
            eq(aiSummaries.factsHash, key.factsHash),
          ),
        );
      return row ? { text: row.text, speechText: row.speechText, usedAi: row.usedAi } : null;
    },
    async saveSummary(key, value) {
      await db
        .insert(aiSummaries)
        .values({ ...key, text: value.text, speechText: value.speechText, usedAi: true })
        .onConflictDoNothing();
    },
  };
}
