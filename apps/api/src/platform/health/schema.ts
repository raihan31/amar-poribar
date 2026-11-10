import { doublePrecision, pgSchema, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

const platform = pgSchema("platform");

/** One row per metric per minute, written by `platform.health.sample`; kept 14 days (FR-ADM-10). */
export const healthSamples = platform.table(
  "health_samples",
  {
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    key: text("key").notNull(),
    value: doublePrecision("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.at] })],
);
