import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import type { InboxItemDto } from "../app/notify-types.js";
import { inboxItems } from "../schema.js";

type Row = typeof inboxItems.$inferSelect;

function toDto(r: Row): InboxItemDto {
  return {
    id: r.id,
    kind: r.kind as InboxItemDto["kind"],
    familyId: r.familyId,
    title: r.title,
    body: r.body,
    speechText: r.speechText,
    data: r.data as Record<string, unknown>,
    createdAt: r.createdAt.toISOString(),
    readAt: r.readAt ? r.readAt.toISOString() : null,
    seq: r.seq,
  };
}

/** Newest first. `after` is a (created_at text, id) pair kept as text so microseconds survive. */
export async function listPage(
  db: Db,
  userId: string,
  limit: number,
  after: { ts: string; id: string } | null,
): Promise<{ rows: (InboxItemDto & { cursorTs: string })[]; hasMore: boolean }> {
  const cond = after
    ? and(
        eq(inboxItems.userId, userId),
        sql`(${inboxItems.createdAt}, ${inboxItems.id}) < (${after.ts}::timestamptz, ${after.id}::uuid)`,
      )
    : eq(inboxItems.userId, userId);
  const rows = await db
    .select({ r: inboxItems, cursorTs: sql<string>`${inboxItems.createdAt}::text` })
    .from(inboxItems)
    .where(cond)
    .orderBy(desc(inboxItems.createdAt), desc(inboxItems.id))
    .limit(limit + 1);
  return {
    rows: rows.slice(0, limit).map((x) => ({ ...toDto(x.r), cursorTs: x.cursorTs })),
    hasMore: rows.length > limit,
  };
}

export async function countUnread(db: Db, userId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(inboxItems)
    .where(and(eq(inboxItems.userId, userId), isNull(inboxItems.readAt)));
  return rows[0]?.n ?? 0;
}

export async function markRead(db: Db, userId: string, ids: string[] | null, now: Date): Promise<number> {
  const where = and(
    eq(inboxItems.userId, userId),
    isNull(inboxItems.readAt),
    ids ? inArray(inboxItems.id, ids) : undefined,
  );
  const rows = await db.update(inboxItems).set({ readAt: now }).where(where).returning({ id: inboxItems.id });
  return rows.length;
}

export async function deleteAll(db: Db, userId: string): Promise<void> {
  await db.delete(inboxItems).where(eq(inboxItems.userId, userId));
}

export async function deleteOne(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(inboxItems)
    .where(and(eq(inboxItems.userId, userId), eq(inboxItems.id, id)))
    .returning({ id: inboxItems.id });
  return rows.length > 0;
}

/** Items with seq greater than `afterSeq`, ascending; without it, the last `limit`. */
export async function listChanges(
  db: Db,
  userId: string,
  afterSeq: number | null,
  limit: number,
): Promise<InboxItemDto[]> {
  if (afterSeq === null) {
    const rows = await db
      .select()
      .from(inboxItems)
      .where(eq(inboxItems.userId, userId))
      .orderBy(desc(inboxItems.seq))
      .limit(limit);
    return rows.reverse().map(toDto);
  }
  const rows = await db
    .select()
    .from(inboxItems)
    .where(and(eq(inboxItems.userId, userId), sql`${inboxItems.seq} > ${afterSeq}`))
    .orderBy(inboxItems.seq)
    .limit(limit);
  return rows.map(toDto);
}
