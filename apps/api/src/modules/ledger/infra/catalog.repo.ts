import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import type { Tx } from "../../../platform/events/bus.js";
import { defaultAccountRows, defaultCategoryRows } from "../domain/seed-defaults.js";
import type { BalanceRow } from "../domain/balance.js";
import { accounts, categories, transactions } from "../schema.js";

/** Either the pooled connection or an open transaction. */
export type Executor = Db | Tx;

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type NewCategory = typeof categories.$inferInsert;

export const catalogRepo = {
  listCategories(x: Executor, familyId: string, includeHidden: boolean): Promise<Category[]> {
    return x
      .select()
      .from(categories)
      .where(
        includeHidden
          ? eq(categories.familyId, familyId)
          : and(eq(categories.familyId, familyId), eq(categories.isHidden, false)),
      );
  },

  getCategoriesByKeys(x: Executor, familyId: string, keys: readonly string[]): Promise<Category[]> {
    if (keys.length === 0) return Promise.resolve([]);
    return x
      .select()
      .from(categories)
      .where(and(eq(categories.familyId, familyId), inArray(categories.key, [...keys])));
  },

  listAccounts(x: Executor, familyId: string, includeArchived: boolean): Promise<Account[]> {
    return x
      .select()
      .from(accounts)
      .where(
        includeArchived
          ? eq(accounts.familyId, familyId)
          : and(eq(accounts.familyId, familyId), isNull(accounts.archivedAt)),
      );
  },

  async insertAccount(x: Executor, values: NewAccount): Promise<Account> {
    const [row] = await x.insert(accounts).values(values).returning();
    return row!;
  },

  async updateAccount(
    x: Executor,
    familyId: string,
    accountId: string,
    set: Partial<NewAccount>,
  ): Promise<Account | null> {
    const [row] = await x
      .update(accounts)
      .set(set)
      .where(and(eq(accounts.id, accountId), eq(accounts.familyId, familyId)))
      .returning();
    return row ?? null;
  },

  async insertCategory(x: Executor, values: NewCategory): Promise<Category> {
    const [row] = await x.insert(categories).values(values).returning();
    return row!;
  },

  async updateCategory(
    x: Executor,
    familyId: string,
    categoryId: string,
    set: Partial<NewCategory>,
  ): Promise<Category | null> {
    const [row] = await x
      .update(categories)
      .set(set)
      .where(and(eq(categories.id, categoryId), eq(categories.familyId, familyId)))
      .returning();
    return row ?? null;
  },

  async categoryExists(x: Executor, familyId: string, id: string): Promise<boolean> {
    const [c] = await x
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.familyId, familyId)));
    return Boolean(c);
  },

  async accountExists(
    x: Executor,
    familyId: string,
    id: string,
    opts: { activeOnly?: boolean } = {},
  ): Promise<boolean> {
    const [a] = await x
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, id),
          eq(accounts.familyId, familyId),
          opts.activeOnly ? isNull(accounts.archivedAt) : undefined,
        ),
      );
    return Boolean(a);
  },

  /** Locks the family's accounts so two concurrent archives cannot both pass the last-account check. */
  async lockAccounts(x: Executor, familyId: string): Promise<Account[]> {
    return x.select().from(accounts).where(eq(accounts.familyId, familyId)).for("update");
  },

  /**
   * One grouped query over all non-deleted rows of the family, private ones included (the balance must be
   * true, T-LED-08). Rows with no source account and no destination cannot affect any balance.
   */
  async balanceRows(x: Executor, familyId: string): Promise<BalanceRow[]> {
    const rows = await x
      .select({
        type: transactions.type,
        accountId: transactions.accountId,
        toAccountId: transactions.toAccountId,
        amountPaisa: sql<string>`coalesce(sum(${transactions.amountPaisa}), 0)`,
        feePaisa: sql<string>`coalesce(sum(${transactions.feePaisa}), 0)`,
      })
      .from(transactions)
      .where(and(eq(transactions.familyId, familyId), isNull(transactions.deletedAt)))
      .groupBy(transactions.type, transactions.accountId, transactions.toAccountId);
    return rows.map((r) => ({ ...r, amountPaisa: Number(r.amountPaisa), feePaisa: Number(r.feePaisa) }));
  },

  async ownedIds(x: Executor, familyId: string): Promise<{ categories: Set<string>; accounts: Set<string> }> {
    const [cats, accs] = await Promise.all([
      x.select({ id: categories.id }).from(categories).where(eq(categories.familyId, familyId)),
      x.select({ id: accounts.id }).from(accounts).where(eq(accounts.familyId, familyId)),
    ]);
    return { categories: new Set(cats.map((c) => c.id)), accounts: new Set(accs.map((a) => a.id)) };
  },

  async seedDefaults(x: Executor, familyId: string, ownerUserId: string | null): Promise<void> {
    await x
      .insert(categories)
      .values(defaultCategoryRows(familyId))
      .onConflictDoNothing({ target: [categories.familyId, categories.key] });
    const [existing] = await x
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.familyId, familyId))
      .limit(1);
    if (!existing) await x.insert(accounts).values(defaultAccountRows(familyId, ownerUserId));
  },
};
