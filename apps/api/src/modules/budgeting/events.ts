/**
 * Declared now so the alert engine (T-BUD-02) can publish it later; nothing emits it yet.
 * `threshold` is the percentage of the limit that was crossed (FR-BUD-02).
 */
export interface BudgetThresholdCrossedPayload {
  familyId: string;
  budgetId: string;
  categoryId: string | null;
  month: string;
  threshold: 80 | 100;
  spentPaisa: number;
  limitPaisa: number;
}

declare module "../../platform/events/types.js" {
  interface EventMap {
    "budgeting.BudgetThresholdCrossed.v1": BudgetThresholdCrossedPayload;
  }
}
