import { index, integer, jsonb, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const platformSchema = pgSchema("platform");

export const outbox = platformSchema.table(
  "outbox",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    payload: jsonb("payload").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    familyId: uuid("family_id"),
    status: text("status").notNull().default("pending"), // pending | done | dead
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
  },
  (t) => [index("outbox_status_next_attempt_idx").on(t.status, t.nextAttemptAt)],
);

export const outboxDeliveries = platformSchema.table(
  "outbox_deliveries",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => outbox.id, { onDelete: "cascade" }),
    handler: text("handler").notNull(),
    status: text("status").notNull().default("pending"), // pending | done
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.handler] })],
);
