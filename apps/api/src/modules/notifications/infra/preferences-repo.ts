import {
  PREFERENCE_KINDS,
  type NotificationPreferences,
  type UpdateNotificationPreferences,
} from "@amar-poribar/shared";
import { eq } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import { preferences } from "../schema.js";

const hhmm = (t: string): string => t.slice(0, 5);

function defaultKinds(): NotificationPreferences["kinds"] {
  return Object.fromEntries(PREFERENCE_KINDS.map((k) => [k, true])) as NotificationPreferences["kinds"];
}

function defaults(): NotificationPreferences {
  return {
    kinds: defaultKinds(),
    quietStart: "22:00",
    quietEnd: "06:00",
    dailyReminderTime: "21:00",
    dailyReminderEnabled: true,
    hidePresence: false,
  };
}

function fromRow(row: typeof preferences.$inferSelect): NotificationPreferences {
  const stored = (row.kinds ?? {}) as Partial<Record<string, boolean>>;
  const kinds = defaultKinds();
  for (const k of PREFERENCE_KINDS) {
    const v = stored[k];
    if (typeof v === "boolean") kinds[k] = v;
  }
  return {
    kinds,
    quietStart: hhmm(row.quietStart),
    quietEnd: hhmm(row.quietEnd),
    dailyReminderTime: hhmm(row.dailyReminderTime),
    dailyReminderEnabled: row.dailyReminderEnabled,
    hidePresence: row.hidePresence,
  };
}

/** Defaults when no row exists; reading never creates a row. */
export async function readPreferences(db: Db, userId: string): Promise<NotificationPreferences> {
  const [row] = await db.select().from(preferences).where(eq(preferences.userId, userId));
  return row ? fromRow(row) : defaults();
}

/** Merges the patch over the current values and upserts; returns the full object. */
export async function updatePreferences(
  db: Db,
  userId: string,
  patch: UpdateNotificationPreferences,
): Promise<NotificationPreferences> {
  const current = await readPreferences(db, userId);
  const next: NotificationPreferences = {
    kinds: { ...current.kinds, ...patch.kinds },
    quietStart: patch.quietStart ?? current.quietStart,
    quietEnd: patch.quietEnd ?? current.quietEnd,
    dailyReminderTime: patch.dailyReminderTime ?? current.dailyReminderTime,
    dailyReminderEnabled: patch.dailyReminderEnabled ?? current.dailyReminderEnabled,
    hidePresence: patch.hidePresence ?? current.hidePresence,
  };
  const values = { ...next, updatedAt: new Date() };
  await db
    .insert(preferences)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: preferences.userId, set: values });
  return next;
}
