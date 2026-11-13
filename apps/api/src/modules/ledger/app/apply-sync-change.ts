import type { Role, SyncTransaction } from "@amar-poribar/shared";
import { winsOver } from "../../../platform/hlc.js";
import { catalogRepo } from "../infra/catalog.repo.js";
import { stampChange } from "../infra/stamp-change.js";
import { transactionsRepo } from "../infra/transactions.repo.js";
import type { LedgerDeps } from "./deps.js";
import { isUniqueViolation } from "../infra/pg-errors.js";
import { publishCreated, publishDeleted, publishUpdated } from "./publish.js";

export type ApplyResult =
  | { status: "applied" }
  /** The server already holds this version or a newer one; nothing changed. */
  | { status: "stale" }
  | { status: "rejected"; reason: "unknown_reference" | "forbidden" | "id_taken" | "duplicate_trx_id" };

/**
 * Merge one pushed row (SRS §4.3.1): the greater HLC wins per record, so pushing twice is harmless.
 * Each row has its own transaction: a duplicate TrxID rejects that row only. Events are published after the
 * merge, inside the same transaction.
 */
export async function applyChange(
  deps: LedgerDeps,
  familyId: string,
  userId: string,
  role: Role,
  r: SyncTransaction,
): Promise<ApplyResult> {
  // References must belong to this family (tenant isolation, NFR-06).
  if (
    (r.categoryId && !(await catalogRepo.categoryExists(deps.db, familyId, r.categoryId))) ||
    (r.accountId && !(await catalogRepo.accountExists(deps.db, familyId, r.accountId))) ||
    (r.toAccountId && !(await catalogRepo.accountExists(deps.db, familyId, r.toAccountId)))
  ) {
    return { status: "rejected", reason: "unknown_reference" };
  }
  // Older builds send no destination; a transfer without one cannot be stored (T-LED-08).
  const toAccountId = r.type === "transfer" ? (r.toAccountId ?? null) : null;
  if (r.type === "transfer" && (!toAccountId || toAccountId === r.accountId)) {
    return { status: "rejected", reason: "unknown_reference" };
  }
  try {
    return await deps.db.transaction(async (tx): Promise<ApplyResult> => {
      const existing = await transactionsRepo.lockById(tx, r.id);
      if (existing && existing.familyId !== familyId) return { status: "rejected", reason: "id_taken" };
      if (existing && !winsOver(r.hlc, existing.hlc)) return { status: "stale" };
      if (existing && existing.createdBy !== userId && !deps.families.canEditAll(role)) {
        return { status: "rejected", reason: "forbidden" };
      }
      const { updatedAt, syncSeq } = stampChange();
      const values = {
        type: r.type,
        amountPaisa: r.amountPaisa,
        feePaisa: r.feePaisa,
        occurredAt: new Date(r.occurredAt),
        categoryId: r.categoryId ?? null,
        accountId: r.accountId ?? null,
        toAccountId,
        note: r.note ?? null,
        counterparty: r.counterparty ?? null,
        trxId: r.trxId ?? null,
        source: r.source,
        isPrivate: r.isPrivate,
        deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
        hlc: r.hlc, // the device's HLC is kept, not re-stamped
        syncSeq,
        updatedAt,
      };
      if (existing) {
        const row = await transactionsRepo.update(tx, r.id, values);
        const deleted = row.deletedAt !== null && existing.deletedAt === null;
        const restored = row.deletedAt === null && existing.deletedAt !== null;
        if (deleted) await publishDeleted(deps.bus, tx, row);
        else await publishUpdated(deps.bus, tx, row, existing, restored ? "restore" : "edit");
      } else {
        const row = await transactionsRepo.insert(tx, {
          ...values,
          id: r.id,
          familyId,
          paidByUserId: userId,
          createdBy: userId,
        });
        await publishCreated(deps.bus, tx, row);
      }
      return { status: "applied" };
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { status: "rejected", reason: "duplicate_trx_id" };
    throw e;
  }
}
