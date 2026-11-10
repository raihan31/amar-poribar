import { monthRange, monthsBetween } from "../domain/month.js";
import { totalsRepo } from "../infra/totals.repo.js";
import type { LedgerDeps } from "./deps.js";

export interface RemittanceByMonth {
  months: { month: string; remittancePaisa: number; expensePaisa: number }[];
  totalRemittancePaisa: number;
  bySender: { name: string | null; totalPaisa: number }[];
}

/** Remittance received vs. spending for each month from `from` to `to` (YYYY-MM, inclusive), BR-13. */
export async function remittanceByMonth(
  deps: LedgerDeps,
  familyId: string,
  userId: string,
  from: string,
  to: string,
): Promise<RemittanceByMonth> {
  const range = { start: monthRange(from).start, end: monthRange(to).end };
  const { remitted, spent, senders } = await totalsRepo.remittanceAndSpend(deps.db, familyId, userId, range);
  return {
    months: monthsBetween(from, to).map((month) => ({
      month,
      remittancePaisa: remitted.get(month) ?? 0,
      expensePaisa: spent.get(month) ?? 0,
    })),
    totalRemittancePaisa: [...remitted.values()].reduce((a, b) => a + b, 0),
    bySender: senders,
  };
}
