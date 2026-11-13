import { bigint, boolean, integer, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const aiSchema = pgSchema("ai");

/** Monthly AI usage per family and feature: requests, tokens, latency, errors (FR-AI-12, FR-AI-14). Numbers only. */
export const aiUsage = aiSchema.table(
  "ai_usage",
  {
    // families.families.id (no cross-schema foreign key, DEC-02)
    familyId: uuid("family_id").notNull(),
    month: text("month").notNull(),
    // parse | receipt | ask | summary | legacy (rows from before metering)
    feature: text("feature").notNull().default("legacy"),
    requests: integer("requests").notNull().default(0),
    inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
    outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
    latencyMsSum: bigint("latency_ms_sum", { mode: "number" }).notNull().default(0),
    errors: integer("errors").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.familyId, t.month, t.feature] })],
);

/** Cached monthly summaries; regenerated only when the underlying totals change. */
export const aiSummaries = aiSchema.table(
  "ai_summaries",
  {
    // families.families.id
    familyId: uuid("family_id").notNull(),
    month: text("month").notNull(),
    locale: text("locale").notNull(),
    factsHash: text("facts_hash").notNull(),
    text: text("text").notNull(),
    speechText: text("speech_text").notNull(),
    usedAi: boolean("used_ai").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.familyId, t.month, t.locale, t.factsHash] })],
);
