import { boolean, integer, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const aiSchema = pgSchema("ai");

/** Monthly count of AI requests per family (FR-AI-12). */
export const aiUsage = aiSchema.table(
  "ai_usage",
  {
    // families.families.id (no cross-schema foreign key, DEC-02)
    familyId: uuid("family_id").notNull(),
    month: text("month").notNull(),
    requests: integer("requests").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.familyId, t.month] })],
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
