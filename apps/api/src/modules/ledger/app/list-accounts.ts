import type { Role } from "@amar-poribar/shared";
import { balanceOf } from "../domain/balance.js";
import { catalogRepo, type Account } from "../infra/catalog.repo.js";
import type { LedgerDeps } from "./deps.js";

/** One account as E1 shows it (T-LED-08). `balancePaisa` is null when the caller may not see it. */
export interface AccountDto {
  id: string;
  name: string;
  type: Account["type"];
  ownerUserId: string | null;
  openingBalancePaisa: number;
  balancePaisa: number | null;
  archivedAt: string | null;
}

/**
 * Who may see a balance: the owner of a personal account; members and above for shared accounts; admins and
 * owners for every account. Viewers and other members' personal accounts get null (decision recorded in the PR).
 */
function canSeeBalance(deps: LedgerDeps, a: Account, userId: string, role: Role): boolean {
  if (deps.families.canEditAll(role)) return true;
  if (a.ownerUserId === userId) return true;
  return a.ownerUserId === null && role !== "viewer";
}

export async function listAccountsWithBalance(
  deps: LedgerDeps,
  input: { familyId: string; userId: string; role: Role; includeArchived: boolean },
): Promise<AccountDto[]> {
  const { familyId, userId, role } = input;
  const accounts = await catalogRepo.listAccounts(deps.db, familyId, input.includeArchived);
  const rows = accounts.some((a) => canSeeBalance(deps, a, userId, role))
    ? await catalogRepo.balanceRows(deps.db, familyId)
    : [];
  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    ownerUserId: a.ownerUserId,
    openingBalancePaisa: a.openingBalancePaisa,
    balancePaisa: canSeeBalance(deps, a, userId, role) ? balanceOf(a.id, a.openingBalancePaisa, rows) : null,
    archivedAt: a.archivedAt ? a.archivedAt.toISOString() : null,
  }));
}
