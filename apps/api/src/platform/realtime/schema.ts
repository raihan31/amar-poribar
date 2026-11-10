import { pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

const platform = pgSchema("platform");

/** Frames too large for a NOTIFY payload; the notification carries only the row id. Rows are short-lived. */
export const realtimePayloads = platform.table("realtime_payloads", {
  id: uuid("id").primaryKey(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
