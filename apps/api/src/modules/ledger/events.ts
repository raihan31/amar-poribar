/**
 * Payload of every transaction event. It carries the amount because events are internal; staff never receive
 * events (SRS DEC-18). `occurredAt` is the transaction time as an ISO string, not the event time.
 */
export interface TransactionEventPayload {
  familyId: string;
  transactionId: string;
  type: "expense" | "income" | "transfer";
  amountPaisa: number;
  categoryId: string | null;
  occurredAt: string;
  isPrivate: boolean;
  createdBy: string;
}

declare module "../../platform/events/types.js" {
  interface EventMap {
    "ledger.TransactionCreated.v1": TransactionEventPayload;
    "ledger.TransactionUpdated.v1": TransactionEventPayload;
    "ledger.TransactionDeleted.v1": TransactionEventPayload;
  }
}
