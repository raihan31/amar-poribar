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
    async reserve(familyId, month, feature, limit) {
      // The advisory lock serialises reservations per family: without it two first-time inserts would both pass the
      // total check, because ON CONFLICT re-checks only against the statement's own snapshot.
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ai_usage:${familyId}`}))`);
        const total = sql`(select coalesce(sum(requests), 0) from ai.ai_usage where family_id = ${familyId} and month = ${month})`;
        const rows = await tx.execute(sql`
          insert into ai.ai_usage (family_id, month, feature, requests)
          select ${familyId}, ${month}, ${feature}, 1 where ${total} < ${limit}
          on conflict (family_id, month, feature) do update set requests = ai_usage.requests + 1
          where ${total} < ${limit}
          returning requests`);
        return rows.length > 0;
      });
    },
    async release(familyId, month, feature) {
      await db
        .update(aiUsage)
        .set({ requests: sql`greatest(${aiUsage.requests} - 1, 0)` })
        .where(and(eq(aiUsage.familyId, familyId), eq(aiUsage.month, month), eq(aiUsage.feature, feature)));
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
