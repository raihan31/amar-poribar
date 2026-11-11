export interface BudgetRow {
  categoryId: string | null;
  month: string;
  limitPaisa: number;
}

/**
 * Budgets in force for `month`. Each category (or the overall budget) uses the latest row set
 * for that month or an earlier one, so last month's budgets carry forward unless changed (FR-BUD-03).
 * A limit of 0 means the budget was cleared.
 */
export function effectiveBudgets(rows: BudgetRow[], month: string): (BudgetRow & { inherited: boolean })[] {
  const latest = new Map<string, BudgetRow>();
  for (const r of rows) {
    if (r.month > month) continue;
    const key = r.categoryId ?? "overall";
    const prev = latest.get(key);
    if (!prev || r.month > prev.month) latest.set(key, r);
  }
  return [...latest.values()].filter((r) => r.limitPaisa > 0).map((r) => ({ ...r, inherited: r.month !== month }));
}
