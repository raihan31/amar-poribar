import type { Role, SyncTransaction } from "@amar-poribar/shared";
import { transactionsRepo, type Transaction } from "../infra/transactions.repo.js";
import type { LedgerDeps } from "./deps.js";

export const SYNC_PAGE = 500;

export function toWire(r: Transaction): SyncTransaction {
  return {
    id: r.id,
    type: r.type,
    amountPaisa: r.amountPaisa,
    feePaisa: r.feePaisa,
    occurredAt: r.occurredAt.toISOString(),
    categoryId: r.categoryId,
    accountId: r.accountId,
    toAccountId: r.toAccountId,
    note: r.note,
    counterparty: r.counterparty,
    trxId: r.trxId,
    source: r.source,
    isPrivate: r.isPrivate,
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
    hlc: r.hlc,
  };
}

export interface ChangesPage {
  changes: SyncTransaction[];
  /** Highest `syncSeq` in `changes`, or the cursor that was passed when there are none. */
  cursor: number;
  more: boolean;
}

/**
 * Everything the device has not downloaded yet, by delivery order (not HLC), tombstones included.
 * Other members' private entries are never sent (FR-TXN-05). `role` is for the caller's access rule:
 * viewers are summary-only (FR-FAM-05), so they get nothing.
 */
export async function listChangesAfter(
  deps: LedgerDeps,
  familyId: string,
  userId: string,
  role: Role,
  seq: number,
  limit: number = SYNC_PAGE,
): Promise<ChangesPage> {
  if (role === "viewer") return { changes: [], cursor: seq, more: false };
  const rows = await transactionsRepo.changesAfter(deps.db, familyId, userId, seq, limit + 1);
  const page = rows.slice(0, limit);
  return { changes: page.map(toWire), cursor: page.at(-1)?.syncSeq ?? seq, more: rows.length > limit };
}
