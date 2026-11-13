import { HttpError } from "../../../platform/errors.js";
import { currentDhakaMonth, monthsBetween, previousMonth } from "../../../platform/time/month.js";
import type { ReportingDeps } from "./deps.js";

export interface RemittanceReport {
  from: string;
  to: string;
  months: { month: string; remittancePaisa: number; expensePaisa: number; leftOverPaisa: number }[];
  totalRemittancePaisa: number;
  bySender: { name: string | null; totalPaisa: number }[];
}

/** BR-13: remittance received vs. spending by month. The default window is the six months ending at `to`. */
export async function remittances(
  deps: Pick<ReportingDeps, "ledger">,
  familyId: string,
  userId: string,
  query: { from?: string | undefined; to?: string | undefined },
): Promise<RemittanceReport> {
  const to = query.to ?? currentDhakaMonth();
  let defaultFrom = to;
  for (let i = 0; i < 5; i++) defaultFrom = previousMonth(defaultFrom);
  const from = query.from ?? defaultFrom;
  if (to < from) throw new HttpError(400, "invalid_request", "`to` must not be before `from`");
  if (monthsBetween(from, to).length > 24) throw new HttpError(400, "invalid_request", "Range is limited to 24 months");

  // Month figures come from the series; the sender split (current shape, dropped by T-REP-03) is not a series.
  const [series, r] = await Promise.all([
    deps.ledger.getMonthlySeries(familyId, { userId }, from, to),
    deps.ledger.remittanceByMonth(familyId, userId, from, to),
  ]);
  const months = series.map((m) => {
    const remittancePaisa = m.byCategoryKey["remittance"]?.incomePaisa ?? 0;
    return {
      month: m.month,
      remittancePaisa,
      expensePaisa: m.expensePaisa,
      leftOverPaisa: remittancePaisa - m.expensePaisa,
    };
  });
  return {
    from,
    to,
    months,
    totalRemittancePaisa: months.reduce((a, m) => a + m.remittancePaisa, 0),
    bySender: r.bySender.map((s) => ({ name: s.name || null, totalPaisa: s.totalPaisa })),
  };
}
