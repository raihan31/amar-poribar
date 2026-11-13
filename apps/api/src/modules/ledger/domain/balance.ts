import type { TransactionType } from "@amar-poribar/shared";

/** Totals of non-deleted rows that share a type, source account and destination (all in paisa). */
export interface BalanceRow {
  type: TransactionType;
  accountId: string | null;
  toAccountId: string | null;
  amountPaisa: number;
  feePaisa: number;
}

/**
 * FR-ACC-03: balance = opening + income - (expense + fee) - (transfer out + fee) + transfer in.
 * Rows may be single transactions or sums of many; the rule is linear. Private rows are included
 * on purpose: the balance must be true (T-LED-08).
 */
export function balanceOf(accountId: string, openingPaisa: number, rows: readonly BalanceRow[]): number {
  let balance = openingPaisa;
  for (const r of rows) {
    if (r.accountId === accountId) {
      if (r.type === "income") balance += r.amountPaisa;
      else balance -= r.amountPaisa + r.feePaisa; // expense and transfer out
    }
    if (r.type === "transfer" && r.toAccountId === accountId) balance += r.amountPaisa;
  }
  return balance;
}
