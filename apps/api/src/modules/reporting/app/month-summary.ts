import type { MonthSummary } from "@amar-poribar/shared";
import { previousMonth } from "../../../platform/time/month.js";
import type { ReportingDeps } from "./deps.js";

/** Income, expense and breakdowns for `month` against the month before, as visible to `userId` (FR-REP-01). */
export async function monthSummary(
  deps: Pick<ReportingDeps, "ledger">,
  familyId: string,
  userId: string,
  month: string,
): Promise<MonthSummary> {
  const prevMonth = previousMonth(month);
  const [totals, prev] = await Promise.all([
    deps.ledger.monthTotals(familyId, userId, month),
    deps.ledger.monthTotals(familyId, userId, prevMonth),
  ]);
  return {
    month,
    incomePaisa: totals.incomePaisa,
    expensePaisa: totals.expensePaisa,
    previous: { month: prevMonth, incomePaisa: prev.incomePaisa, expensePaisa: prev.expensePaisa },
    byCategory: totals.byCategory.map(({ categoryId, name, totalPaisa }) => ({ categoryId, name, totalPaisa })),
    byMember: totals.byMember,
    byAccount: totals.byAccount,
  };
}
