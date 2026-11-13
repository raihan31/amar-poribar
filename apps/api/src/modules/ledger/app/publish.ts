import type { EventBus, Tx } from "../../../platform/events/bus.js";
import type { TransactionBefore, TransactionCreatedV1 } from "../events.js";
import type { Transaction } from "../infra/transactions.repo.js";

/** Never includes `counterparty` or `trxId` (T-LED-04). */
function payloadOf(row: Transaction): TransactionCreatedV1 {
  return {
    familyId: row.familyId,
    transactionId: row.id,
    type: row.type,
    amountPaisa: row.amountPaisa,
    feePaisa: row.feePaisa,
    categoryId: row.categoryId,
    accountId: row.accountId,
    occurredAt: row.occurredAt.toISOString(),
    isPrivate: row.isPrivate,
    createdBy: row.createdBy,
    paidByUserId: row.paidByUserId,
    source: row.source,
    note: row.note,
  };
}

function beforeOf(row: Transaction): TransactionBefore {
  return {
    type: row.type,
    amountPaisa: row.amountPaisa,
    feePaisa: row.feePaisa,
    categoryId: row.categoryId,
    occurredAt: row.occurredAt.toISOString(),
    isPrivate: row.isPrivate,
  };
}

/** Publish inside the writer's transaction, so the outbox row commits or rolls back with the change. */
export function publishCreated(bus: EventBus, tx: Tx, row: Transaction): Promise<unknown> {
  return bus.publish(tx, "ledger.TransactionCreated.v1", payloadOf(row), { familyId: row.familyId });
}

export function publishUpdated(
  bus: EventBus,
  tx: Tx,
  row: Transaction,
  before: Transaction,
  kind: "edit" | "restore" = "edit",
): Promise<unknown> {
  return bus.publish(
    tx,
    "ledger.TransactionUpdated.v1",
    { ...payloadOf(row), kind, before: beforeOf(before) },
    { familyId: row.familyId },
  );
}

export function publishDeleted(bus: EventBus, tx: Tx, row: Transaction): Promise<unknown> {
  return bus.publish(tx, "ledger.TransactionDeleted.v1", payloadOf(row), { familyId: row.familyId });
}
