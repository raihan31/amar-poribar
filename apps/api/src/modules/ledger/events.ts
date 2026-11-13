/**
 * Payload of every transaction event. It carries the amount because events are internal; staff never receive
 * events (SRS DEC-18). `occurredAt` is the transaction time as an ISO string, not the event time. It never
 * carries `counterparty` or `trxId`.
 */
export interface TransactionCreatedV1 {
  familyId: string;
  transactionId: string;
  type: "expense" | "income" | "transfer";
  amountPaisa: number;
  feePaisa: number;
  categoryId: string | null;
  accountId: string | null;
  occurredAt: string;
  isPrivate: boolean;
  createdBy: string;
  paidByUserId: string | null;
  source: "manual" | "ai_text" | "sms" | "voice" | "receipt";
  note: string | null;
}

/** What a budget or report listener needs to reverse the old figures. */
export interface TransactionBefore {
  type: "expense" | "income" | "transfer";
  amountPaisa: number;
  feePaisa: number;
  categoryId: string | null;
  occurredAt: string;
  isPrivate: boolean;
}

export type TransactionUpdatedV1 = TransactionCreatedV1 & { kind: "edit" | "restore"; before: TransactionBefore };
export type TransactionDeletedV1 = TransactionCreatedV1;

/** @deprecated Use {@link TransactionCreatedV1}. */
export type TransactionEventPayload = TransactionCreatedV1;

declare module "../../platform/events/types.js" {
  interface EventMap {
    "ledger.TransactionCreated.v1": TransactionCreatedV1;
    "ledger.TransactionUpdated.v1": TransactionUpdatedV1;
    "ledger.TransactionDeleted.v1": TransactionDeletedV1;
  }
}
