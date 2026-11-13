import type { Viewer } from "../../ledger/index.js";
import { effectiveBudgets } from "../domain/effective.js";
import { budgetLevel, type BudgetLevel } from "../domain/level.js";
import { statusWords, type StatusWords } from "../domain/words.js";
import { budgetsRepo } from "../infra/budgets.repo.js";
import type { BudgetingDeps } from "./deps.js";

export interface BudgetSummaryItem {
  categoryId: string | null;
  nameEn: string;
  nameBn: string;
  limitPaisa: number;
  spentPaisa: number;
  /** `limitPaisa - spentPaisa`; negative once the budget is exceeded. */
  remainingPaisa: number;
  level: BudgetLevel;
  status: StatusWords;
  inherited: boolean;
  /** True when the job stored this month's row from last month, so the UI can say "গত মাসের বাজেট". */
  carried: boolean;
}

export interface BudgetSummary {
  month: string;
  budgets: BudgetSummaryItem[];
}

export interface EffectiveBudget {
  categoryId: string | null;
  limitPaisa: number;
  inherited: boolean;
}

/** Budgets in force for `month` (FR-BUD-03), for the alert engine and the sync reference bundle. */
export async function getEffectiveBudgets(
  deps: BudgetingDeps,
  familyId: string,
  month: string,
): Promise<EffectiveBudget[]> {
  const rows = await effectiveWithCarried(deps, familyId, month);
  return rows.map(({ categoryId, limitPaisa, inherited }) => ({ categoryId, limitPaisa, inherited }));
}

async function effectiveWithCarried(
  deps: BudgetingDeps,
  familyId: string,
  month: string,
): Promise<(EffectiveBudget & { carried: boolean })[]> {
  const rows = effectiveBudgets(await budgetsRepo.listUpTo(deps.db, familyId, month), month);
  return rows.map(({ categoryId, limitPaisa, inherited, source }) => ({
    categoryId,
    limitPaisa,
    inherited,
    carried: source === "carried",
  }));
}

// FR-BUD-01, FR-BUD-02, FR-BUD-03, FR-BUD-07
export async function getBudgetStatus(
  deps: BudgetingDeps,
  familyId: string,
  viewer: Viewer,
  month: string,
): Promise<BudgetSummary> {
  const effective = await effectiveWithCarried(deps, familyId, month);
  const totals = await deps.ledger.getMonthTotals(familyId, viewer, month);
  const spentBy = new Map(totals.byCategory.map((c) => [c.categoryId, c.totalPaisa]));
  const catById = new Map((await deps.ledger.listCategories(familyId, { includeHidden: true })).map((c) => [c.id, c]));
  return {
    month,
    budgets: effective.map((b) => {
      const spentPaisa = b.categoryId ? (spentBy.get(b.categoryId) ?? 0) : totals.expensePaisa;
      const cat = b.categoryId ? catById.get(b.categoryId) : undefined;
      const nameBn = b.categoryId ? (cat?.nameBn ?? "") : "মোট";
      const level = budgetLevel(spentPaisa, b.limitPaisa);
      return {
        categoryId: b.categoryId,
        nameEn: b.categoryId ? (cat?.nameEn ?? "") : "Overall",
        nameBn,
        limitPaisa: b.limitPaisa,
        spentPaisa,
        remainingPaisa: b.limitPaisa - spentPaisa,
        level,
        status: statusWords(level, { categoryNameBn: nameBn, overPaisa: Math.max(0, spentPaisa - b.limitPaisa) }),
        inherited: b.inherited,
        carried: b.carried,
      };
    }),
  };
}
