import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { accounts, categories, transactions } from "../schema.js";
import type { Executor } from "./catalog.repo.js";
import { visibleToCaller } from "./visibility.js";

export interface ExportRow {
  occurredAt: Date;
  type: "expense" | "income" | "transfer";
  amountPaisa: number;
  feePaisa: number;
  categoryEn: string | null;
  categoryBn: string | null;
  accountName: string | null;
  counterparty: string | null;
  trxId: string | null;
  note: string | null;
}

const EXPORT_PAGE = 1000;
const amountWithFee = sql`${transactions.amountPaisa} + ${transactions.feePaisa}`;

const inRange = (range: { start: Date; end: Date }) =>
  and(gte(transactions.occurredAt, range.start), lt(transactions.occurredAt, range.end));

export const totalsRepo = {
  async typeTotals(
    x: Executor,
    familyId: string,
    userId: string,
    range: { start: Date; end: Date },
  ): Promise<{ type: string; total: number }[]> {
    const rows = await x
      .select({ type: transactions.type, total: sql<string>`coalesce(sum(${amountWithFee}), 0)` })
      .from(transactions)
      .where(and(visibleToCaller(familyId, userId), inRange(range)))
      .groupBy(transactions.type);
    return rows.map((r) => ({ type: r.type, total: Number(r.total) }));
  },

  async expenseByCategory(x: Executor, familyId: string, userId: string, range: { start: Date; end: Date }) {
    const rows = await x
      .select({
        categoryId: transactions.categoryId,
        name: sql<string>`coalesce(${categories.nameBn}, 'অন্যান্য')`,
        nameEn: sql<string>`coalesce(${categories.nameEn}, 'Other')`,
        total: sql<string>`sum(${amountWithFee})`,
      })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(visibleToCaller(familyId, userId), inRange(range), eq(transactions.type, "expense")))
      .groupBy(transactions.categoryId, categories.nameBn, categories.nameEn)
      .orderBy(sql`4 desc`);
    return rows.map((r) => ({ ...r, totalPaisa: Number(r.total) }));
  },

  async expenseByPayer(x: Executor, familyId: string, userId: string, range: { start: Date; end: Date }) {
    const rows = await x
      .select({ id: transactions.paidByUserId, total: sql<string>`sum(${amountWithFee})` })
      .from(transactions)
      .where(and(visibleToCaller(familyId, userId), inRange(range), eq(transactions.type, "expense")))
      .groupBy(transactions.paidByUserId)
      .orderBy(sql`2 desc`);
    return rows.map((r) => ({ id: r.id, totalPaisa: Number(r.total) }));
  },

  async expenseByAccount(x: Executor, familyId: string, userId: string, range: { start: Date; end: Date }) {
    const rows = await x
      .select({
        id: transactions.accountId,
        name: sql<string>`coalesce(${accounts.name}, 'অন্যান্য')`,
        total: sql<string>`sum(${amountWithFee})`,
      })
      .from(transactions)
      .leftJoin(accounts, eq(accounts.id, transactions.accountId))
      .where(and(visibleToCaller(familyId, userId), inRange(range), eq(transactions.type, "expense")))
      .groupBy(transactions.accountId, accounts.name)
      .orderBy(sql`3 desc`);
    return rows.map((r) => ({ id: r.id, name: r.name, totalPaisa: Number(r.total) }));
  },

  async expenseTotalBetween(
    x: Executor,
    familyId: string,
    userId: string,
    range: { start: Date; end: Date },
  ): Promise<number> {
    const [row] = await x
      .select({ total: sql<string>`coalesce(sum(${amountWithFee}), 0)` })
      .from(transactions)
      .where(and(visibleToCaller(familyId, userId), inRange(range), eq(transactions.type, "expense")));
    return Number(row?.total ?? 0);
  },

  /** Newest first, at most `limit` visible rows in the range, with category names (Ask tool). */
  async listWithCategory(
    x: Executor,
    familyId: string,
    userId: string,
    range: { start: Date; end: Date },
    limit: number,
  ) {
    return x
      .select({ t: transactions, nameEn: categories.nameEn, nameBn: categories.nameBn })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(visibleToCaller(familyId, userId), inRange(range)))
      .orderBy(desc(transactions.occurredAt))
      .limit(limit);
  },

  /** Oldest first, read in pages so a two-year export never holds every row at once. */
  async *exportRows(
    x: Executor,
    familyId: string,
    userId: string,
    range: { start: Date; end: Date },
  ): AsyncGenerator<ExportRow> {
    for (let offset = 0; ; offset += EXPORT_PAGE) {
      const rows = await x
        .select({
          t: transactions,
          categoryEn: categories.nameEn,
          categoryBn: categories.nameBn,
          account: accounts.name,
        })
        .from(transactions)
        .leftJoin(categories, eq(categories.id, transactions.categoryId))
        .leftJoin(accounts, eq(accounts.id, transactions.accountId))
        .where(and(visibleToCaller(familyId, userId), inRange(range)))
        .orderBy(asc(transactions.occurredAt), asc(transactions.id))
        .limit(EXPORT_PAGE)
        .offset(offset);
      for (const r of rows) {
        yield {
          occurredAt: r.t.occurredAt,
          type: r.t.type,
          amountPaisa: r.t.amountPaisa,
          feePaisa: r.t.feePaisa,
          categoryEn: r.categoryEn,
          categoryBn: r.categoryBn,
          accountName: r.account,
          counterparty: r.t.counterparty,
          trxId: r.t.trxId,
          note: r.t.note,
        };
      }
      if (rows.length < EXPORT_PAGE) return;
    }
  },

  /** Income in the `remittance` category and all spending, per Dhaka month (BR-13). */
  async remittanceAndSpend(x: Executor, familyId: string, userId: string, range: { start: Date; end: Date }) {
    const visible = and(visibleToCaller(familyId, userId), inRange(range));
    const ym = sql<string>`to_char(${transactions.occurredAt} at time zone 'Asia/Dhaka', 'YYYY-MM')`;
    const remitted = await x
      .select({ month: ym, total: sql<string>`sum(${transactions.amountPaisa})` })
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(visible, eq(transactions.type, "income"), eq(categories.key, "remittance")))
      .groupBy(ym);
    const spent = await x
      .select({ month: ym, total: sql<string>`sum(${amountWithFee})` })
      .from(transactions)
      .where(and(visible, eq(transactions.type, "expense")))
      .groupBy(ym);
    const senders = await x
      .select({
        name: sql<string>`coalesce(${transactions.counterparty}, '')`,
        total: sql<string>`sum(${transactions.amountPaisa})`,
      })
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(visible, eq(transactions.type, "income"), eq(categories.key, "remittance")))
      .groupBy(transactions.counterparty)
      .orderBy(sql`2 desc`);
    return {
      remitted: new Map(remitted.map((r) => [r.month, Number(r.total)])),
      spent: new Map(spent.map((r) => [r.month, Number(r.total)])),
      senders: senders.map((s) => ({ name: s.name || null, totalPaisa: Number(s.total) })),
    };
  },
};
