import type { Role, UpdateTransactionInput } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { stampChange } from "../infra/stamp-change.js";
import { transactionsRepo, type Transaction } from "../infra/transactions.repo.js";
import type { LedgerDeps } from "./deps.js";
import { publishUpdated } from "./publish.js";
import { assertRefs } from "./queries.js";

/** FR-TXN-03: members edit their own entries; admins and owners edit any. */
export async function updateTransaction(
  deps: LedgerDeps,
  input: { familyId: string; txnId: string; actorId: string; role: Role; data: UpdateTransactionInput },
): Promise<Transaction> {
  const { familyId, txnId, actorId, role, data } = input;
  const txn = await transactionsRepo.findVisible(deps.db, familyId, actorId, txnId);
  if (!txn) throw new HttpError(404, "not_found", "Transaction not found");
  if (txn.createdBy !== actorId && !deps.families.canEditAll(role)) {
    throw new HttpError(403, "forbidden", "You can only edit your own entries");
  }
  await assertRefs(deps.db, familyId, data);
  const { occurredAt, ...fields } = data;
  return deps.db.transaction(async (tx) => {
    const row = await transactionsRepo.update(tx, txnId, {
      ...fields,
      ...(occurredAt ? { occurredAt: new Date(occurredAt) } : {}),
      ...stampChange(txn.hlc),
    });
    await publishUpdated(deps.bus, tx, row, txn);
    return row;
  });
}
