import { and, asc, desc, eq, gt, gte, lt } from "drizzle-orm";
import type { PgInsertValue, PgUpdateSetSource } from "drizzle-orm/pg-core";
import { transactions } from "../schema.js";
import type { Executor } from "./catalog.repo.js";
import { stampChange } from "./stamp-change.js";
import { notPrivateToOthers, visibleTo } from "../infra/visibility.js";

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = PgInsertValue<typeof transactions>;
export type TransactionChanges = PgUpdateSetSource<typeof transactions>;

export const transactionsRepo = {
  /** Newest first, at most 200. TODO(P1): cursor pagination (FR-TXN-02, T-LED-01). */
  list(x: Executor, familyId: string, userId: string, range?: { start: Date; end: Date }): Promise<Transaction[]> {
    const conditions = [visibleTo(familyId, { userId })];
    if (range) conditions.push(gte(transactions.occurredAt, range.start), lt(transactions.occurredAt, range.end));
    return x
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.occurredAt))
      .limit(200);
  },

  async findVisible(x: Executor, familyId: string, userId: string, txnId: string): Promise<Transaction | null> {
    const [row] = await x
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, txnId), visibleTo(familyId, { userId })));
    return row ?? null;
  },

  /** Row lock for the sync merge. */
  async lockById(x: Executor, txnId: string): Promise<Transaction | null> {
    const [row] = await x.select().from(transactions).where(eq(transactions.id, txnId)).for("update");
    return row ?? null;
  },

  /** Null when the id or the family's TrxID already exists. */
  async insert(x: Executor, values: NewTransaction): Promise<Transaction | null> {
    const [row] = await x.insert(transactions).values(values).onConflictDoNothing().returning();
    return row ?? null;
  },

  /** Plain insert for the sync merge, where a duplicate TrxID must surface as a unique violation. */
  async insertStrict(x: Executor, values: NewTransaction): Promise<Transaction> {
    const [row] = await x.insert(transactions).values(values).returning();
    return row!;
  },

  async update(x: Executor, txnId: string, set: TransactionChanges): Promise<Transaction> {
    const [row] = await x.update(transactions).set(set).where(eq(transactions.id, txnId)).returning();
    return row!;
  },

  /** Everything after `seq` in delivery order, tombstones included, minus other members' private entries. */
  changesAfter(x: Executor, familyId: string, userId: string, seq: number, limit: number): Promise<Transaction[]> {
    return x
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.familyId, familyId),
          seq > 0 ? gt(transactions.syncSeq, seq) : undefined,
          notPrivateToOthers(userId),
        ),
      )
      .orderBy(asc(transactions.syncSeq))
      .limit(limit);
  },

  /** Tombstone: the row stays so that devices learn about the delete (FR-SYNC-05). */
  async softDelete(x: Executor, txnId: string, prevHlc: string): Promise<Transaction> {
    return transactionsRepo.update(x, txnId, { deletedAt: new Date(), ...stampChange(prevHlc) });
  },
};
