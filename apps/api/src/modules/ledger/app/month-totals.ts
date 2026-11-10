import { monthRange } from "../domain/month.js";
import { totalsRepo } from "../infra/totals.repo.js";
import type { LedgerDeps } from "./deps.js";

export interface MonthTotals {
  incomePaisa: number;
  expensePaisa: number;
  byCategory: { categoryId: string | null; name: string; nameEn: string; totalPaisa: number }[];
  byMember: { id: string | null; name: string; totalPaisa: number }[];
  byAccount: { id: string | null; name: string; totalPaisa: number }[];
}

/** Income, expense and per-category expense for a month, as visible to `userId` (FR-TXN-05). */
export async function monthTotals(
  deps: LedgerDeps,
  familyId: string,
  userId: string,
  month: string,
): Promise<MonthTotals> {
  const range = monthRange(month);
  const [totals, byCategory, payers, byAccount] = await Promise.all([
    totalsRepo.typeTotals(deps.db, familyId, userId, range),
    totalsRepo.expenseByCategory(deps.db, familyId, userId, range),
    totalsRepo.expenseByPayer(deps.db, familyId, userId, range),
    totalsRepo.expenseByAccount(deps.db, familyId, userId, range),
  ]);
  // Names belong to identity; ledger stores only the user id.
  const labels = await deps.families.getUserLabels(payers.flatMap((p) => (p.id ? [p.id] : [])));
  const totalOf = (type: string) => totals.find((t) => t.type === type)?.total ?? 0;
  return {
    incomePaisa: totalOf("income"),
    expensePaisa: totalOf("expense"),
    byCategory: byCategory.map(({ categoryId, name, nameEn, totalPaisa }) => ({
      categoryId,
      name,
      nameEn,
      totalPaisa,
    })),
    byMember: payers.map((p) => ({
      id: p.id,
      name: (p.id ? labels.get(p.id) : undefined) ?? "অজানা",
      totalPaisa: p.totalPaisa,
    })),
    byAccount,
  };
}

/** Expense in `[start, end)`, as visible to `userId`. Festival budgets use it. */
export function expenseTotalBetween(
  deps: LedgerDeps,
  familyId: string,
  userId: string,
  start: Date,
  end: Date,
): Promise<number> {
  return totalsRepo.expenseTotalBetween(deps.db, familyId, userId, { start, end });
}
