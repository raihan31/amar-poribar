import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import type { AiStore } from "../app/deps.js";
import { aiSummaries, aiUsage } from "../schema.js";

export function createAiStore(db: Db): AiStore {
  return {
    async requestsUsed(familyId, month) {
      const [row] = await db
        .select({ requests: aiUsage.requests })
        .from(aiUsage)
        .where(and(eq(aiUsage.familyId, familyId), eq(aiUsage.month, month)));
      return row?.requests ?? 0;
    },
    async recordUse(familyId, month) {
      await db
        .insert(aiUsage)
        .values({ familyId, month, requests: 1 })
        .onConflictDoUpdate({
          target: [aiUsage.familyId, aiUsage.month],
          set: { requests: sql`${aiUsage.requests} + 1` },
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
