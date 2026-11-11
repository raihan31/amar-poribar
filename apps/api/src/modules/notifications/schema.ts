import { INBOX_KINDS } from "@amar-poribar/shared";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const notificationsSchema = pgSchema("notifications");

const kindList = sql.raw(INBOX_KINDS.map((k) => `'${k}'`).join(", "));

/** One inbox card per user per notification (FR-NOTIF-04). Kept 90 days. */
export const inboxItems = notificationsSchema.table(
  "inbox_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // identity.users.id, integrity via UserErased handler
    userId: uuid("user_id").notNull(),
    // families.families.id (no cross-schema foreign key, DEC-02)
    familyId: uuid("family_id"),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    speechText: text("speech_text").notNull(),
    data: jsonb("data").notNull().default({}),
    dedupeKey: text("dedupe_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
    /** Monotonic cursor for the polling fallback (FR-NOTIF-08). */
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity().notNull(),
  },
  (t) => [
    check("inbox_items_kind_check", sql`${t.kind} in (${kindList})`),
    index("inbox_items_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("inbox_items_user_seq_idx").on(t.userId, t.seq),
    uniqueIndex("inbox_items_user_dedupe_idx")
      .on(t.userId, t.dedupeKey)
      .where(sql`${t.dedupeKey} is not null`),
  ],
);

/** Per-user notification preferences (FR-NOTIF-05). A missing kind in `kinds` means enabled. */
export const preferences = notificationsSchema.table("preferences", {
  // identity.users.id, integrity via UserErased handler
  userId: uuid("user_id").primaryKey(),
  kinds: jsonb("kinds").notNull().default({}),
  quietStart: time("quiet_start").notNull().default("22:00"),
  quietEnd: time("quiet_end").notNull().default("06:00"),
  dailyReminderTime: time("daily_reminder_time").notNull().default("21:00"),
  dailyReminderEnabled: boolean("daily_reminder_enabled").notNull().default(true),
  hidePresence: boolean("hide_presence").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Per-day delivery counters by channel and kind, read by the admin dashboard (T-ADM-12). */
export const deliveryStats = notificationsSchema.table(
  "delivery_stats",
  {
    day: date("day").notNull(),
    /** "socket" | "push" | "inbox_only". */
    channel: text("channel").notNull(),
    kind: text("kind").notNull(),
    ok: integer("ok").notNull().default(0),
    failed: integer("failed").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.channel, t.kind] })],
);
