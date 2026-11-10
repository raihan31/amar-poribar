import { sql } from "drizzle-orm";
import { bigint, check, index, jsonb, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const privacySchema = pgSchema("privacy");

/** One record per export or erasure request (FR-PRIV-05). Staff see counts and status only. */
export const requests = privacySchema.table(
  "requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // identity.users.id (no cross-schema foreign key, DEC-02)
    userId: uuid("user_id").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("open"),
    step: text("step").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    /** requested_at + 30 days (PDPO, FR-PRIV-03/04). */
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    graceUntil: timestamp("grace_until", { withTimezone: true }),
    meta: jsonb("meta").notNull().default({}),
    rejectedReason: text("rejected_reason"),
  },
  (t) => [
    check("requests_kind_check", sql`${t.kind} in ('export', 'erasure')`),
    check("requests_status_check", sql`${t.status} in ('open', 'in_progress', 'done', 'rejected', 'cancelled')`),
    index("requests_user_kind_status_idx").on(t.userId, t.kind, t.status),
    index("requests_status_due_idx").on(t.status, t.dueAt),
    // At most one live export and one live erasure per user.
    uniqueIndex("requests_one_open_per_kind_idx")
      .on(t.userId, t.kind)
      .where(sql`${t.status} in ('open', 'in_progress')`),
  ],
);

/** A generated export archive in object storage; removed when `expires_at` passes. */
export const exportFiles = privacySchema.table("export_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  // privacy.requests.id
  requestId: uuid("request_id").notNull(),
  storageKey: text("storage_key").notNull(),
  bytes: bigint("bytes", { mode: "number" }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
