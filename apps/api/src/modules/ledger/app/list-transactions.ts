import { monthRange } from "../domain/month.js";
import { transactionsRepo, type Transaction } from "../infra/transactions.repo.js";
import type { LedgerDeps } from "./deps.js";

export function listTransactions(
  deps: LedgerDeps,
  input: { familyId: string; userId: string; month?: string | undefined },
): Promise<Transaction[]> {
  return transactionsRepo.list(
    deps.db,
    input.familyId,
    input.userId,
    input.month ? monthRange(input.month) : undefined,
  );
}
