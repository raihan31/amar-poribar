import type { ListTransactionsQuery } from "@amar-poribar/shared";
import { dayRange, monthRange } from "../../../platform/time/month.js";
import { decodeCursor, type ListCursor } from "./cursor.js";

export interface TransactionFilter {
  /** `[start, end)`; either side may be open. */
  start?: Date | undefined;
  end?: Date | undefined;
  categoryId?: string | undefined;
  memberId?: string | undefined;
  accountId?: string | undefined;
  type?: ListTransactionsQuery["type"];
  source?: ListTransactionsQuery["source"];
  /** Text to find in note or counterparty, unescaped. */
  q?: string | undefined;
  limit: number;
  cursor?: ListCursor | undefined;
}

/** Turns the validated query into a filter: Asia/Dhaka days become instants, the cursor is decoded. */
export function toFilter(query: ListTransactionsQuery): TransactionFilter {
  let start: Date | undefined;
  let end: Date | undefined;
  if (query.month) ({ start, end } = monthRange(query.month));
  if (query.from) start = dayRange(query.from, query.from).start;
  if (query.to) end = dayRange(query.to, query.to).end;
  return {
    start,
    end,
    categoryId: query.categoryId,
    memberId: query.memberId,
    accountId: query.accountId,
    type: query.type,
    source: query.source,
    q: query.q || undefined,
    limit: query.limit,
    cursor: query.cursor ? decodeCursor(query.cursor) : undefined,
  };
}

/** Escapes `\`, `%` and `_` so user text is matched literally by `ILIKE`. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** `YYYY-MM-DD` of an instant in Asia/Dhaka (UTC+6, no DST). */
export function dhakaDayKey(at: Date): string {
  return new Date(at.getTime() + 6 * 3600_000).toISOString().slice(0, 10);
}
