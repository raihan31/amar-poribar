import { and, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import type { Db } from "./db/client.js";
import { accounts, categories, transactions, users } from "./db/schema.js";
import { monthRange } from "./month.js";

export interface MonthTotals {
  incomePaisa: number;
  expensePaisa: number;
  byCategory: { categoryId: string | null; name: string; nameEn: string; totalPaisa: number }[];
  byMember: { id: string | null; name: string; totalPaisa: number }[];
  byAccount: { id: string | null; name: string; totalPaisa: number }[];
}

/** Income, expense and per-category expense for a month, as visible to `userId` (FR-TXN-05). */
export async function monthTotals(db: Db, familyId: string, userId: string, month: string): Promise<MonthTotals> {
  const { start, end } = monthRange(month);
  const where = and(
    eq(transactions.familyId, familyId),
    isNull(transactions.deletedAt),
    gte(transactions.occurredAt, start),
    lt(transactions.occurredAt, end),
    or(eq(transactions.isPrivate, false), eq(transactions.createdBy, userId)),
  );

  const totals = await db
    .select({
      type: transactions.type,
      total: sql<string>`coalesce(sum(${transactions.amountPaisa} + ${transactions.feePaisa}), 0)`,
    })
    .from(transactions)
    .where(where)
    .groupBy(transactions.type);

  const byCategory = await db
    .select({
      categoryId: transactions.categoryId,
      name: sql<string>`coalesce(${categories.nameBn}, 'অন্যান্য')`,
      nameEn: sql<string>`coalesce(${categories.nameEn}, 'Other')`,
      total: sql<string>`sum(${transactions.amountPaisa} + ${transactions.feePaisa})`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(where, eq(transactions.type, "expense")))
    .groupBy(transactions.categoryId, categories.nameBn, categories.nameEn)
    .orderBy(sql`4 desc`);

  const byMember = await db
    .select({
      id: transactions.paidByUserId,
      name: sql<string>`coalesce(${users.name}, ${users.phone}, 'অজানা')`,
      total: sql<string>`sum(${transactions.amountPaisa} + ${transactions.feePaisa})`,
    })
    .from(transactions)
    .leftJoin(users, eq(users.id, transactions.paidByUserId))
    .where(and(where, eq(transactions.type, "expense")))
    .groupBy(transactions.paidByUserId, users.name, users.phone)
    .orderBy(sql`3 desc`);

  const byAccount = await db
    .select({
      id: transactions.accountId,
      name: sql<string>`coalesce(${accounts.name}, 'অন্যান্য')`,
      total: sql<string>`sum(${transactions.amountPaisa} + ${transactions.feePaisa})`,
    })
    .from(transactions)
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(and(where, eq(transactions.type, "expense")))
    .groupBy(transactions.accountId, accounts.name)
    .orderBy(sql`3 desc`);

  const totalOf = (type: string) => Number(totals.find((t) => t.type === type)?.total ?? 0);
  return {
    incomePaisa: totalOf("income"),
    expensePaisa: totalOf("expense"),
    byCategory: byCategory.map((c) => ({
      categoryId: c.categoryId,
      name: c.name,
      nameEn: c.nameEn,
      totalPaisa: Number(c.total),
    })),
    byMember: byMember.map((m) => ({ id: m.id, name: m.name, totalPaisa: Number(m.total) })),
    byAccount: byAccount.map((a) => ({ id: a.id, name: a.name, totalPaisa: Number(a.total) })),
  };
}
