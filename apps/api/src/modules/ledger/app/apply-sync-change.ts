import type { Role, SyncTransaction } from "@amar-poribar/shared";
import { winsOver } from "../../../platform/hlc.js";
import { catalogRepo } from "../infra/catalog.repo.js";
import { stampChange } from "../infra/stamp-change.js";
import { transactionsRepo } from "../infra/transactions.repo.js";
import type { LedgerDeps } from "./deps.js";
import { publishTransaction } from "./publish.js";

export type ApplyResult =
  | { status: "applied" }
  /** The server already holds this version or a newer one; nothing changed. */
  | { status: "stale" }
  | { status: "rejected"; reason: "unknown_reference" | "forbidden" | "id_taken" | "duplicate_trx_id" };

/** Postgres unique violation (23505). Drizzle wraps driver errors, so the code may be on `cause`. */
function isUniqueViolation(e: unknown): boolean {
  const code = (x: unknown) => (x as { code?: string } | null | undefined)?.code;
  return code(e) === "23505" || code((e as { cause?: unknown } | null)?.cause) === "23505";
}

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
    (r.accountId && !(await catalogRepo.accountExists(deps.db, familyId, r.accountId)))
  ) {
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
        await publishTransaction(
          deps.bus,
          tx,
          deleted ? "ledger.TransactionDeleted.v1" : "ledger.TransactionUpdated.v1",
          row,
        );
      } else {
        const row = await transactionsRepo.insertStrict(tx, {
          ...values,
          id: r.id,
          familyId,
          paidByUserId: userId,
          createdBy: userId,
        });
        await publishTransaction(deps.bus, tx, "ledger.TransactionCreated.v1", row);
      }
      return { status: "applied" };
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { status: "rejected", reason: "duplicate_trx_id" };
    throw e;
  }
}
