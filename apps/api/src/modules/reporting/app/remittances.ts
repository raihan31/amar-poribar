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

  const r = await deps.ledger.remittanceByMonth(familyId, userId, from, to);
  return {
    from,
    to,
    months: r.months.map((m) => ({ ...m, leftOverPaisa: m.remittancePaisa - m.expensePaisa })),
    totalRemittancePaisa: r.totalRemittancePaisa,
    bySender: r.bySender.map((s) => ({ name: s.name || null, totalPaisa: s.totalPaisa })),
  };
}
