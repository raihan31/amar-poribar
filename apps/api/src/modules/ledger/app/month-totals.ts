import { monthRange } from "../../../platform/time/month.js";
import type { Viewer } from "../domain/viewer.js";
import { totalsRepo } from "../infra/totals.repo.js";
import type { LedgerDeps } from "./deps.js";

export interface MonthTotals {
  incomePaisa: number;
  expensePaisa: number;
  byCategory: { categoryId: string | null; name: string; nameEn: string; totalPaisa: number }[];
  byMember: { id: string | null; name: string; totalPaisa: number }[];
  byAccount: { id: string | null; name: string; totalPaisa: number }[];
}

export interface RangeTotals {
  incomePaisa: number;
  expensePaisa: number;
  byCategory: MonthTotals["byCategory"];
}

const categoryRows = (rows: Awaited<ReturnType<typeof totalsRepo.expenseByCategory>>): MonthTotals["byCategory"] =>
  rows.map(({ categoryId, name, nameEn, totalPaisa }) => ({ categoryId, name, nameEn, totalPaisa }));

/** Income, expense and per-category expense for a month, as visible to `viewer` (FR-TXN-05). */
export async function getMonthTotals(
  deps: LedgerDeps,
  familyId: string,
  viewer: Viewer,
  month: string,
): Promise<MonthTotals> {
  const range = monthRange(month);
  const [totals, byCategory, payers, byAccount] = await Promise.all([
    totalsRepo.typeTotals(deps.db, familyId, viewer, range),
    totalsRepo.expenseByCategory(deps.db, familyId, viewer, range),
    totalsRepo.expenseByPayer(deps.db, familyId, viewer, range),
    totalsRepo.expenseByAccount(deps.db, familyId, viewer, range),
  ]);
  // Names belong to identity; ledger stores only the user id.
  const labels = await deps.families.getUserLabels(payers.flatMap((p) => (p.id ? [p.id] : [])));
  const totalOf = (type: string) => totals.find((t) => t.type === type)?.total ?? 0;
  return {
    incomePaisa: totalOf("income"),
    expensePaisa: totalOf("expense"),
    byCategory: categoryRows(byCategory),
    byMember: payers.map((p) => ({
      id: p.id,
      name: (p.id ? labels.get(p.id) : undefined) ?? "অজানা",
      totalPaisa: p.totalPaisa,
    })),
    byAccount,
  };
}

/** Income, expense and per-category expense in `[from, to)` (festival budgets). */
export async function getRangeTotals(
  deps: LedgerDeps,
  familyId: string,
  viewer: Viewer,
  from: Date,
  to: Date,
): Promise<RangeTotals> {
  const range = { start: from, end: to };
  const [totals, byCategory] = await Promise.all([
    totalsRepo.typeTotals(deps.db, familyId, viewer, range),
    totalsRepo.expenseByCategory(deps.db, familyId, viewer, range),
  ]);
  const totalOf = (type: string) => totals.find((t) => t.type === type)?.total ?? 0;
  return { incomePaisa: totalOf("income"), expensePaisa: totalOf("expense"), byCategory: categoryRows(byCategory) };
}
