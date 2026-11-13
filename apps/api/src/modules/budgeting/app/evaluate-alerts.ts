import { currentDhakaMonth } from "../../../platform/time/month.js";
import { levelOf, reachedThresholds } from "../domain/thresholds.js";
import { alertsRepo } from "../infra/alerts.repo.js";
import type { AlertDeps } from "./deps.js";
import { getEffectiveBudgets } from "./get-budgets.js";

export const OVERALL = "overall";

/**
 * Recompute the given budget keys for `month` and publish a threshold event for each newly reached threshold
 * (FR-BUD-05). Only current-month, family-visible spending counts, so an alert never discloses private spending.
 * Existing alert rows are never removed when spending falls; the unique key makes replays harmless.
 */
export async function evaluateAlerts(
  deps: AlertDeps,
  familyId: string,
  month: string,
  keys: ReadonlySet<string>,
): Promise<void> {
  if (month !== currentDhakaMonth(deps.clock())) return;
  const effective = await getEffectiveBudgets(deps, familyId, month);
  const wanted = effective.filter((b) => keys.has(b.categoryId ?? OVERALL) && b.limitPaisa > 0);
  if (wanted.length === 0) return;
  const totals = await deps.ledger.getMonthTotals(familyId, "family", month);
  const cats = new Map((await deps.ledger.listCategories(familyId, { includeHidden: true })).map((c) => [c.id, c]));
  const spentBy = new Map(totals.byCategory.map((c) => [c.categoryId, c.totalPaisa]));

  for (const b of wanted) {
    const budgetKey = b.categoryId ?? OVERALL;
    const spentPaisa = b.categoryId ? (spentBy.get(b.categoryId) ?? 0) : totals.expensePaisa;
    const cat = b.categoryId ? cats.get(b.categoryId) : undefined;
    for (const threshold of reachedThresholds(spentPaisa, b.limitPaisa)) {
      await deps.db.transaction(async (tx) => {
        const fresh = await alertsRepo.insertIfNew(tx, {
          familyId,
          budgetKey,
          month,
          threshold,
          spentPaisa,
          limitPaisa: b.limitPaisa,
        });
        if (!fresh) return;
        await deps.bus.publish(
          tx,
          "budgeting.BudgetThresholdCrossed.v1",
          {
            familyId,
            budgetKey,
            categoryId: b.categoryId,
            categoryNameBn: b.categoryId ? (cat?.nameBn ?? "") : "মোট",
            categoryNameEn: b.categoryId ? (cat?.nameEn ?? "") : "Overall",
            month,
            threshold,
            level: levelOf(threshold),
            spentPaisa,
            limitPaisa: b.limitPaisa,
          },
          { familyId },
        );
      });
    }
  }
}
