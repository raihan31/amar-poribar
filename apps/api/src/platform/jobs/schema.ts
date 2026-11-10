import { bigserial, jsonb, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

const platform = pgSchema("platform");

/** Results of nightly checks (`platform.integrity.check`, dead-letter report). */
export const healthChecks = platform.table("health_checks", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(), // ok | warn
  details: jsonb("details").notNull().default({}),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});
