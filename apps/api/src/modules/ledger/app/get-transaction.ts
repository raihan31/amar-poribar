import type { Role, TransactionDetail } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { transactionsRepo } from "../infra/transactions.repo.js";
import type { LedgerDeps } from "./deps.js";
import { toListItems } from "./list-transactions.js";
import { RESTORE_WINDOW_MS } from "./restore-transaction.js";

/** One transaction for the detail screen D5, with what the caller may do to it (FR-TXN-10). */
export async function getTransaction(
  deps: LedgerDeps,
  input: { familyId: string; txnId: string; userId: string; role: Role },
): Promise<TransactionDetail> {
  const { familyId, txnId, userId, role } = input;
  const row = await transactionsRepo.findById(deps.db, txnId);
  // Another member's private entry is never revealed, deleted or not (FR-TXN-05).
  if (!row || row.familyId !== familyId || (row.isPrivate && row.createdBy !== userId)) {
    throw new HttpError(404, "not_found", "Transaction not found");
  }
  const canEdit = row.createdBy === userId || deps.families.canEditAll(role);
  if (row.deletedAt) {
    const restorableUntil = row.deletedAt.getTime() + RESTORE_WINDOW_MS;
    if (!canEdit || restorableUntil < deps.clock().getTime()) {
      throw new HttpError(404, "not_found", "Transaction not found");
    }
    throw new HttpError(410, "transaction_deleted", "This entry was deleted", {
      restorableUntil: new Date(restorableUntil).toISOString(),
    });
  }
  const [item] = await toListItems(deps, [row], userId);
  return {
    ...item!,
    trxId: row.trxId,
    aiConfidence: row.aiConfidence,
    // Split groups, transfers and attachments arrive with T-LED-08/09 and later; the columns do not exist yet.
    splitGroupId: null,
    toAccountId: row.toAccountId,
    attachmentUrl: null,
    canEdit,
    canDelete: canEdit,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
