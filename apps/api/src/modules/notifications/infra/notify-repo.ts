import { sql } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import type { InboxItemDto } from "../app/notify-types.js";
import { deliveryStats, inboxItems } from "../schema.js";

export type NewInboxItem = {
  userId: string;
  familyId: string | null;
  kind: InboxItemDto["kind"];
  title: string;
  body: string;
  speechText: string;
  data: Record<string, unknown>;
  dedupeKey: string | null;
};

/** Inserts an inbox row; returns null when the (user, dedupe key) pair already exists. */
export async function insertInboxItem(db: Db, item: NewInboxItem): Promise<InboxItemDto | null> {
  const rows = await db.insert(inboxItems).values(item).onConflictDoNothing().returning();
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    kind: item.kind,
    familyId: r.familyId,
    title: r.title,
    body: r.body,
    speechText: r.speechText,
    data: r.data as Record<string, unknown>,
    createdAt: r.createdAt.toISOString(),
    readAt: null,
    seq: r.seq,
  };
}

/** Adds to the per-day counter for one (channel, kind). */
export async function addDeliveryStats(
  db: Db,
  row: { day: string; channel: string; kind: string; ok: number; failed: number },
): Promise<void> {
  await db
    .insert(deliveryStats)
    .values(row)
    .onConflictDoUpdate({
      target: [deliveryStats.day, deliveryStats.channel, deliveryStats.kind],
      set: {
        ok: sql`${deliveryStats.ok} + ${row.ok}`,
        failed: sql`${deliveryStats.failed} + ${row.failed}`,
      },
    });
}
