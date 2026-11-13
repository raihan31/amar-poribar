import type { Db } from "../../../platform/db.js";
import { HttpError, notFound } from "../../../platform/errors.js";
import * as repo from "../infra/inbox-repo.js";
import type { InboxItemDto } from "./notify-types.js";

export type InboxList = { items: InboxItemDto[]; nextCursor: string | null; unread: number };

const encodeCursor = (ts: string, id: string) => Buffer.from(JSON.stringify([ts, id])).toString("base64url");

function decodeCursor(cursor: string): { ts: string; id: string } {
  try {
    const v: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      Array.isArray(v) &&
      typeof v[0] === "string" &&
      typeof v[1] === "string" &&
      !Number.isNaN(Date.parse(v[0])) &&
      /^[0-9a-f-]{36}$/i.test(v[1])
    ) {
      return { ts: v[0], id: v[1] };
    }
  } catch {
    // fall through
  }
  throw new HttpError(400, "invalid_request", "Invalid cursor");
}

export async function listInbox(db: Db, userId: string, cursor: string | undefined, limit: number): Promise<InboxList> {
  const after = cursor ? decodeCursor(cursor) : null;
  const [page, unread] = await Promise.all([repo.listPage(db, userId, limit, after), repo.countUnread(db, userId)]);
  const last = page.rows[page.rows.length - 1];
  const items = page.rows.map((row): InboxItemDto => {
    const { cursorTs, ...item } = row;
    void cursorTs;
    return item;
  });
  return { items, nextCursor: page.hasMore && last ? encodeCursor(last.cursorTs, last.id) : null, unread };
}

export async function markInboxRead(
  db: Db,
  userId: string,
  body: { ids?: string[]; all?: true },
  now: Date,
): Promise<{ updated: number }> {
  return { updated: await repo.markRead(db, userId, body.all ? null : (body.ids ?? []), now) };
}

export const clearInbox = (db: Db, userId: string) => repo.deleteAll(db, userId);

export async function deleteInboxItem(db: Db, userId: string, id: string): Promise<void> {
  if (!(await repo.deleteOne(db, userId, id))) throw notFound("Notification not found");
}

/** Polling fallback: without `afterSeq` the last 20 items come back. */
export async function inboxChanges(
  db: Db,
  userId: string,
  afterSeq: number | undefined,
  limit: number,
): Promise<{ items: InboxItemDto[]; lastSeq: number }> {
  const items = await repo.listChanges(db, userId, afterSeq ?? null, afterSeq === undefined ? 20 : limit);
  return { items, lastSeq: items[items.length - 1]?.seq ?? afterSeq ?? 0 };
}
