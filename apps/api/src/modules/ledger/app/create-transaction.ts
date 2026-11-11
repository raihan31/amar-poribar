import type { CreateTransactionInput, Role } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { stampChange } from "../infra/stamp-change.js";
import { isUniqueViolation, violatedConstraint } from "../infra/pg-errors.js";
import { transactionsRepo, type Transaction } from "../infra/transactions.repo.js";
import type { LedgerDeps } from "./deps.js";
import { publishCreated } from "./publish.js";
import { assertRefs } from "./queries.js";

export interface Actor {
  userId: string;
  role: Role;
}

export interface CreateResult {
  row: Transaction;
  /** False when a retry of an earlier request returned the existing row. */
  created: boolean;
}

/**
 * FR-TXN-01, FR-TXN-04. The caller has checked `requireRole(.., "member", { write: true })` and passes the role. Members and above may write; only admins and owners may record on behalf of another
 * member. A retry with the same client id and creator is answered with the existing row.
 */
export async function createTransaction(
  deps: LedgerDeps,
  input: { familyId: string; actor: Actor; data: CreateTransactionInput },
): Promise<CreateResult> {
  const { familyId, actor, data } = input;
  const { role } = actor;
  await assertRefs(deps.db, familyId, data);

  const paidByUserId = data.paidByUserId ?? actor.userId;
  if (paidByUserId !== actor.userId) {
    if (!deps.families.canEditAll(role)) {
      throw new HttpError(403, "forbidden", "Only an admin can record an entry paid by someone else");
    }
    if (!(await deps.families.listMemberIds(familyId)).includes(paidByUserId)) {
      throw new HttpError(400, "invalid_request", "paidByUserId is not a member of this family");
    }
  }

  if (data.id) {
    const existing = await sameClientId(deps, familyId, actor.userId, data.id);
    if (existing) return { row: existing, created: false };
  }

  try {
    const row = await deps.db.transaction(async (tx) => {
      const inserted = await transactionsRepo.insert(tx, {
        ...data,
        occurredAt: new Date(data.occurredAt),
        familyId,
        paidByUserId,
        createdBy: actor.userId,
        ...stampChange(),
      });
      await publishCreated(deps.bus, tx, inserted);
      return inserted;
    });
    return { row, created: true };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    if (violatedConstraint(e) === "txn_family_trx_uidx") {
      // The existing row's id is shown only when the caller may see that row (FR-TXN-05).
      const dup = data.trxId
        ? await transactionsRepo.findVisibleByTrxId(deps.db, familyId, actor.userId, data.trxId)
        : null;
      throw new HttpError(
        409,
        "duplicate_trx_id",
        "This transaction is already recorded",
        dup ? { transactionId: dup.id } : undefined,
      );
    }
    // Lost a race on the primary key: answer as the pre-check would have.
    if (data.id) {
      const existing = await sameClientId(deps, familyId, actor.userId, data.id);
      if (existing) return { row: existing, created: false };
    }
    throw new HttpError(409, "duplicate_id", "This id is already used");
  }
}

/** The existing row for a retry; 409 when the id belongs to another creator or family. */
async function sameClientId(deps: LedgerDeps, familyId: string, userId: string, id: string) {
  const existing = await transactionsRepo.findById(deps.db, id);
  if (!existing) return null;
  if (existing.familyId !== familyId || existing.createdBy !== userId) {
    throw new HttpError(409, "duplicate_id", "This id is already used");
  }
  return existing;
}
