import type { Role } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { transactionsRepo } from "../infra/transactions.repo.js";
import type { LedgerDeps } from "./deps.js";
import { publishDeleted } from "./publish.js";

export async function deleteTransaction(
  deps: LedgerDeps,
  input: { familyId: string; txnId: string; actorId: string; role: Role },
): Promise<void> {
  const { familyId, txnId, actorId, role } = input;
  const txn = await transactionsRepo.findVisible(deps.db, familyId, actorId, txnId);
  if (!txn) throw new HttpError(404, "not_found", "Transaction not found");
  if (txn.createdBy !== actorId && !deps.families.canEditAll(role)) {
    throw new HttpError(403, "forbidden", "You can only delete your own entries");
  }
  await deps.db.transaction(async (tx) => {
    const row = await transactionsRepo.softDelete(tx, txnId, txn.hlc);
    await publishDeleted(deps.bus, tx, row);
  });
}
