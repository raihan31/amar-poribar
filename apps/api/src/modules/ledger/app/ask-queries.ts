import { monthRange } from "../../../platform/time/month.js";
import { totalsRepo } from "../infra/totals.repo.js";
import type { LedgerDeps } from "./deps.js";
import { getMonthTotals } from "./month-totals.js";

export interface AskQueries {
  sumByCategory(month: string): Promise<{ name: string; totalPaisa: number }[]>;
  compareMonths(
    a: string,
    b: string,
  ): Promise<{
    a: { month: string; incomePaisa: number; expensePaisa: number };
    b: { month: string; incomePaisa: number; expensePaisa: number };
  }>;
  listTransactions(q: { month: string; categoryName?: string | undefined; limit: number }): Promise<
    {
      date: string;
      type: string;
      amountPaisa: number;
      category: string | null;
      note: string | null;
      counterparty: string | null;
    }[]
  >;
}

const LIST_CAP = 200;

/** The three read-only queries behind Ask (FR-AI-10), with visibility applied for `userId`. */
export function askQueries(deps: LedgerDeps, familyId: string, userId: string): AskQueries {
  return {
    sumByCategory: async (month) =>
      (await getMonthTotals(deps, familyId, { userId }, month)).byCategory.map((c) => ({
        name: `${c.nameEn} / ${c.name}`,
        totalPaisa: c.totalPaisa,
      })),
    compareMonths: async (a, b) => {
      const [ta, tb] = await Promise.all([
        getMonthTotals(deps, familyId, { userId }, a),
        getMonthTotals(deps, familyId, { userId }, b),
      ]);
      return {
        a: { month: a, incomePaisa: ta.incomePaisa, expensePaisa: ta.expensePaisa },
        b: { month: b, incomePaisa: tb.incomePaisa, expensePaisa: tb.expensePaisa },
      };
    },
    listTransactions: async ({ month, categoryName, limit }) => {
      const rows = await totalsRepo.listWithCategory(deps.db, familyId, { userId }, monthRange(month), LIST_CAP);
      return rows
        .filter((r) => !categoryName || [r.nameEn, r.nameBn, `${r.nameEn} / ${r.nameBn}`].includes(categoryName))
        .slice(0, limit)
        .map((r) => ({
          date: r.t.occurredAt.toISOString().slice(0, 10),
          type: r.t.type,
          amountPaisa: r.t.amountPaisa,
          category: r.nameEn,
          note: r.t.note,
          counterparty: r.t.counterparty,
        }));
    },
  };
}
