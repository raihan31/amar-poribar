import type { CreateTransactionInput } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { stampChange } from "../infra/stamp-change.js";
import { transactionsRepo, type Transaction } from "../infra/transactions.repo.js";
import type { LedgerDeps } from "./deps.js";
import { publishTransaction } from "./publish.js";
import { assertRefs } from "./queries.js";

/** The caller has already checked the member role. */
export async function createTransaction(
  deps: LedgerDeps,
  input: { familyId: string; actorId: string; data: CreateTransactionInput },
): Promise<Transaction> {
  const { familyId, actorId, data } = input;
  await assertRefs(deps.db, familyId, data);
  return deps.db.transaction(async (tx) => {
    const row = await transactionsRepo.insert(tx, {
      ...data,
      occurredAt: new Date(data.occurredAt),
      familyId,
      paidByUserId: actorId,
      createdBy: actorId,
      ...stampChange(),
    });
    if (!row) throw new HttpError(409, "duplicate", "This transaction (TrxID or id) is already recorded");
    await publishTransaction(deps.bus, tx, "ledger.TransactionCreated.v1", row);
    return row;
  });
}
