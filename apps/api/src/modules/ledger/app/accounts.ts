import type { CreateAccountInput, UpdateAccountInput } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { catalogRepo, type Account, type Executor } from "../infra/catalog.repo.js";
import type { LedgerDeps } from "./deps.js";

/** An account owner must belong to the same family (FR-ACC-02). */
async function assertMember(deps: LedgerDeps, familyId: string, userId: string | null | undefined) {
  if (!userId) return;
  if (!(await deps.families.listMemberIds(familyId)).includes(userId)) {
    throw new HttpError(400, "invalid_request", "Account owner must be a family member");
  }
}

// FR-ACC-01 / FR-ACC-02
export async function createAccount(deps: LedgerDeps, familyId: string, body: CreateAccountInput): Promise<Account> {
  await assertMember(deps, familyId, body.ownerUserId);
  return catalogRepo.insertAccount(deps.db, { ...body, ownerUserId: body.ownerUserId ?? null, familyId });
}

export async function updateAccount(
  deps: LedgerDeps,
  familyId: string,
  accountId: string,
  body: UpdateAccountInput,
): Promise<Account> {
  const { archived, ...rest } = body;
  await assertMember(deps, familyId, rest.ownerUserId);
  const apply = (x: Executor) =>
    catalogRepo.updateAccount(x, familyId, accountId, {
      ...rest,
      ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }),
      updatedAt: new Date(),
    });
  const row = await deps.db.transaction(async (tx) => {
    if (archived) {
      // FR-ACC-04: at least one account must stay usable. Locked so two archives cannot both pass.
      const all = await catalogRepo.lockAccounts(tx, familyId);
      const target = all.find((a) => a.id === accountId);
      if (target && !target.archivedAt && all.filter((a) => !a.archivedAt).length <= 1) {
        throw new HttpError(409, "last_account", "The last account cannot be archived");
      }
    }
    return apply(tx);
  });
  if (!row) throw new HttpError(404, "not_found", "Account not found");
  return row;
}
