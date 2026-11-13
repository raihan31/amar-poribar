import type { Role } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { isUniqueViolation } from "../infra/pg-errors.js";
import { stampChange } from "../infra/stamp-change.js";
import { transactionsRepo, type Transaction } from "../infra/transactions.repo.js";
import type { LedgerDeps } from "./deps.js";
import { publishUpdated } from "./publish.js";

/** Deleted entries can be restored for 30 days (FR-TXN-03). */
export const RESTORE_WINDOW_MS = 30 * 24 * 3600_000;

export async function restoreTransaction(
  deps: LedgerDeps,
  input: { familyId: string; txnId: string; actorId: string; role: Role },
): Promise<Transaction> {
  const { familyId, txnId, actorId, role } = input;
  const txn = await transactionsRepo.findById(deps.db, txnId);
  // Another member's private entry is never revealed (FR-TXN-05).
  if (!txn || txn.familyId !== familyId || !txn.deletedAt || (txn.isPrivate && txn.createdBy !== actorId)) {
    throw new HttpError(404, "not_found", "Transaction not found");
  }
  if (txn.createdBy !== actorId && !deps.families.canEditAll(role)) {
    throw new HttpError(403, "forbidden", "You can only restore your own entries");
  }
  if (txn.deletedAt.getTime() < deps.clock().getTime() - RESTORE_WINDOW_MS) {
    throw new HttpError(410, "restore_window_passed", "This entry was deleted more than 30 days ago");
  }
  try {
    return await deps.db.transaction(async (tx) => {
      const row = await transactionsRepo.update(tx, txnId, { deletedAt: null, ...stampChange(txn.hlc) });
      await publishUpdated(deps.bus, tx, row, txn, "restore");
      return row;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, "duplicate_trx_id", "This transaction is already recorded");
    throw e;
  }
}
