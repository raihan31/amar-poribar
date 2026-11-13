import { monthRange, monthsBetween } from "../../../platform/time/month.js";
import type { Viewer } from "../domain/viewer.js";
import { totalsRepo } from "../infra/totals.repo.js";
import type { LedgerDeps } from "./deps.js";

export interface MonthlyPoint {
  month: string;
  incomePaisa: number;
  expensePaisa: number;
  byCategoryKey: Record<string, { incomePaisa: number; expensePaisa: number }>;
}

/** Key used for entries without a category. */
export const UNCATEGORIZED_KEY = "uncategorized";

/** Income and expense per month from `fromMonth` to `toMonth` (inclusive), zero-filled, as visible to `viewer`. */
export async function getMonthlySeries(
  deps: LedgerDeps,
  familyId: string,
  viewer: Viewer,
  fromMonth: string,
  toMonth: string,
): Promise<MonthlyPoint[]> {
  const months = monthsBetween(fromMonth, toMonth);
  if (months.length === 0) return [];
  const range = { start: monthRange(fromMonth).start, end: monthRange(toMonth).end };
  const rows = await totalsRepo.monthlySeries(deps.db, familyId, viewer, range);
  const byMonth = new Map<string, MonthlyPoint>(
    months.map((month) => [month, { month, incomePaisa: 0, expensePaisa: 0, byCategoryKey: {} }]),
  );
  for (const r of rows) {
    const point = byMonth.get(r.month);
    if (!point) continue;
    const cell = (point.byCategoryKey[r.key ?? UNCATEGORIZED_KEY] ??= { incomePaisa: 0, expensePaisa: 0 });
    if (r.type === "income") {
      point.incomePaisa += r.totalPaisa;
      cell.incomePaisa += r.totalPaisa;
    } else {
      point.expensePaisa += r.totalPaisa;
      cell.expensePaisa += r.totalPaisa;
    }
  }
  return months.map((m) => byMonth.get(m)!);
}
