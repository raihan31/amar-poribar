/**
 * Published once per threshold per family, budget and month by the alert engine (FR-BUD-02, FR-BUD-05).
 * `budgetKey` is `"overall"` or the category uuid.
 */
export interface BudgetThresholdCrossedV1 {
  familyId: string;
  budgetKey: string;
  categoryId: string | null;
  categoryNameBn: string;
  categoryNameEn: string;
  month: string;
  threshold: 80 | 100;
  level: "warning" | "exceeded";
  spentPaisa: number;
  limitPaisa: number;
}

/** Published once per family by `budgeting.carry-forward` when it stored last month's budgets for `month` (FR-BUD-03). */
export interface BudgetsCarriedForwardV1 {
  familyId: string;
  month: string;
  count: number;
}

/** @deprecated Use {@link BudgetThresholdCrossedV1}. */
export type BudgetThresholdCrossedPayload = BudgetThresholdCrossedV1;

declare module "../../platform/events/types.js" {
  interface EventMap {
    "budgeting.BudgetThresholdCrossed.v1": BudgetThresholdCrossedV1;
    "budgeting.BudgetsCarriedForward.v1": BudgetsCarriedForwardV1;
  }
}
