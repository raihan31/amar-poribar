import { and, desc, eq, gte, ilike, inArray, lt, max, or, sql } from "drizzle-orm";
import { escapeLike, type TransactionFilter } from "../domain/filter.js";
import type { Viewer } from "../domain/viewer.js";
import { visibleTo } from "./visibility.js";
import { accounts, categories, transactions } from "../schema.js";
import type { Executor } from "./catalog.repo.js";
import type { Transaction } from "./transactions.repo.js";

export interface VisibleFilter {
  start?: Date | undefined;
  end?: Date | undefined;
  limit?: number | undefined;
}

/** Rows for one page, newest first. Fetches `limit + 1` so the caller can tell whether another page exists. */
export function buildPageQuery(x: Executor, familyId: string, viewer: Viewer, f: TransactionFilter) {
  const c = [visibleTo(familyId, viewer)];
  if (f.start) c.push(gte(transactions.occurredAt, f.start));
  if (f.end) c.push(lt(transactions.occurredAt, f.end));
  if (f.categoryId) c.push(eq(transactions.categoryId, f.categoryId));
  if (f.memberId) c.push(eq(transactions.paidByUserId, f.memberId));
  if (f.accountId) c.push(eq(transactions.accountId, f.accountId));
  if (f.type) c.push(eq(transactions.type, f.type));
  if (f.source) c.push(eq(transactions.source, f.source));
  if (f.q) {
    const pattern = `%${escapeLike(f.q)}%`;
    c.push(or(ilike(transactions.note, pattern), ilike(transactions.counterparty, pattern))!);
  }
  if (f.cursor) {
    c.push(
      sql`(${transactions.occurredAt}, ${transactions.id}) < (${f.cursor.t.toISOString()}::timestamptz, ${f.cursor.id}::uuid)`,
    );
  }
  return (
    x
      .select()
      .from(transactions)
      .where(and(...c))
      // "nulls last" spells the index's order (txn_family_time_idx) so no sort is needed; both columns are not null.
      .orderBy(sql`${transactions.occurredAt} desc nulls last`, sql`${transactions.id} desc nulls last`)
      .limit(f.limit + 1)
  );
}

export const queryRepo = {
  page(x: Executor, familyId: string, viewer: Viewer, filter: TransactionFilter): Promise<Transaction[]> {
    return buildPageQuery(x, familyId, viewer, filter);
  },

  async categoryNames(x: Executor, ids: string[]): Promise<Map<string, { nameBn: string; nameEn: string }>> {
    if (ids.length === 0) return new Map();
    const rows = await x
      .select({ id: categories.id, nameBn: categories.nameBn, nameEn: categories.nameEn })
      .from(categories)
      .where(inArray(categories.id, ids));
    return new Map(rows.map((r) => [r.id, r]));
  },

  async accountNames(x: Executor, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await x
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(inArray(accounts.id, ids));
    return new Map(rows.map((r) => [r.id, r.name]));
  },

  /** Newest first, privacy applied by `visibleTo`. */
  listVisible(x: Executor, familyId: string, viewer: Viewer, filter: VisibleFilter): Promise<Transaction[]> {
    const conditions = [visibleTo(familyId, viewer)];
    if (filter.start) conditions.push(gte(transactions.occurredAt, filter.start));
    if (filter.end) conditions.push(lt(transactions.occurredAt, filter.end));
    return x
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.occurredAt), desc(transactions.id))
      .limit(filter.limit ?? 200);
  },

  /** Latest change of any row, tombstones included. */
  async lastActivity(x: Executor, familyId: string): Promise<Date | null> {
    const [row] = await x
      .select({ at: max(transactions.updatedAt) })
      .from(transactions)
      .where(eq(transactions.familyId, familyId));
    return row?.at ?? null;
  },

  async countTransactions(x: Executor, familyId: string): Promise<number> {
    const [row] = await x
      .select({ n: sql<string>`count(*)` })
      .from(transactions)
      .where(eq(transactions.familyId, familyId));
    return Number(row?.n ?? 0);
  },

  /** Hard delete of everything the family owns in this module (FamilyDeleted). */
  async deleteFamilyRows(x: Executor, familyId: string): Promise<void> {
    await x.delete(transactions).where(eq(transactions.familyId, familyId));
    await x.delete(categories).where(eq(categories.familyId, familyId));
    await x.delete(accounts).where(eq(accounts.familyId, familyId));
  },
};
