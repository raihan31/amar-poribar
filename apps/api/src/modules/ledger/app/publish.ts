import type { EventBus, Tx } from "../../../platform/events/bus.js";
import type { Transaction } from "../infra/transactions.repo.js";

type Name = "ledger.TransactionCreated.v1" | "ledger.TransactionUpdated.v1" | "ledger.TransactionDeleted.v1";

/** Publish inside the writer's transaction, so the outbox row commits or rolls back with the change. */
export function publishTransaction(bus: EventBus, tx: Tx, name: Name, row: Transaction): Promise<unknown> {
  return bus.publish(
    tx,
    name,
    {
      familyId: row.familyId,
      transactionId: row.id,
      type: row.type,
      amountPaisa: row.amountPaisa,
      categoryId: row.categoryId,
      occurredAt: row.occurredAt.toISOString(),
      isPrivate: row.isPrivate,
      createdBy: row.createdBy,
    },
    { familyId: row.familyId },
  );
}
