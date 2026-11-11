import { and, desc, eq, gte, lt, max, sql } from "drizzle-orm";
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

export const queryRepo = {
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
