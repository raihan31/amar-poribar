import { integer, pgSchema, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

const platform = pgSchema("platform");

/** Fixed-window counters. `key` embeds the window length so one key can carry several limits. */
export const rateLimits = platform.table(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);
