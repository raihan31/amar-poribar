export type BudgetLevel = "ok" | "warning" | "exceeded";

/** Alert thresholds from SRS FR-BUD-02: warn at 80%, exceeded at 100%. */
export function budgetLevel(spentPaisa: number, limitPaisa: number): BudgetLevel {
  if (limitPaisa <= 0) return "ok";
  const ratio = spentPaisa / limitPaisa;
  if (ratio >= 1) return "exceeded";
  if (ratio >= 0.8) return "warning";
  return "ok";
}
