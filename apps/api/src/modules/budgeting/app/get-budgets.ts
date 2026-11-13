import { budgetLevel, effectiveBudgets, type BudgetLevel } from "../domain/budget-level.js";
import { budgetsRepo } from "../infra/budgets.repo.js";
import type { BudgetingDeps } from "./deps.js";

export interface BudgetSummaryItem {
  categoryId: string | null;
  nameEn: string;
  nameBn: string;
  limitPaisa: number;
  spentPaisa: number;
  level: BudgetLevel;
  inherited: boolean;
}

export interface BudgetSummary {
  month: string;
  budgets: BudgetSummaryItem[];
}

// FR-BUD-01, FR-BUD-02, FR-BUD-03
export async function getBudgetSummary(
  deps: BudgetingDeps,
  familyId: string,
  userId: string,
  month: string,
): Promise<BudgetSummary> {
  const effective = effectiveBudgets(await budgetsRepo.listUpTo(deps.db, familyId, month), month);
  const totals = await deps.ledger.monthTotals(familyId, userId, month);
  const spentBy = new Map(totals.byCategory.map((c) => [c.categoryId, c.totalPaisa]));
  const catById = new Map((await deps.ledger.listCategories(familyId)).map((c) => [c.id, c]));
  return {
    month,
    budgets: effective.map((b) => {
      const spentPaisa = b.categoryId ? (spentBy.get(b.categoryId) ?? 0) : totals.expensePaisa;
      const cat = b.categoryId ? catById.get(b.categoryId) : undefined;
      return {
        categoryId: b.categoryId,
        nameEn: b.categoryId ? (cat?.nameEn ?? "") : "Overall",
        nameBn: b.categoryId ? (cat?.nameBn ?? "") : "মোট",
        limitPaisa: b.limitPaisa,
        spentPaisa,
        level: budgetLevel(spentPaisa, b.limitPaisa),
        inherited: b.inherited,
      };
    }),
  };
}
