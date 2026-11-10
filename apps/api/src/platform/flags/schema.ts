import { boolean, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

const platform = pgSchema("platform");

export const featureFlags = platform.table("feature_flags", {
  name: text("name").primaryKey(),
  enabled: boolean("enabled").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
