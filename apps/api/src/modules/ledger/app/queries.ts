import { HttpError } from "../../../platform/errors.js";
import type { Viewer } from "../domain/viewer.js";
import { catalogRepo, type Account, type Category, type Executor } from "../infra/catalog.repo.js";
import { queryRepo, type VisibleFilter } from "../infra/query-repo.js";
import type { Transaction } from "../infra/transactions.repo.js";
import type { LedgerDeps } from "./deps.js";

export function listCategories(
  deps: LedgerDeps,
  familyId: string,
  opts: { includeHidden: boolean },
): Promise<Category[]> {
  return catalogRepo.listCategories(deps.db, familyId, opts.includeHidden);
}

export function listAccounts(
  deps: LedgerDeps,
  familyId: string,
  opts: { includeArchived: boolean },
): Promise<Account[]> {
  return catalogRepo.listAccounts(deps.db, familyId, opts.includeArchived);
}

export function getCategoriesByKeys(deps: LedgerDeps, familyId: string, keys: readonly string[]): Promise<Category[]> {
  return catalogRepo.getCategoriesByKeys(deps.db, familyId, keys);
}

/** Newest first. The cursor form arrives with T-LED-05; until then callers bound it with `start`/`end`/`limit`. */
export function listVisibleTransactions(
  deps: LedgerDeps,
  familyId: string,
  viewer: Viewer,
  filter: VisibleFilter,
): Promise<Transaction[]> {
  return queryRepo.listVisible(deps.db, familyId, viewer, filter);
}

export function getLastActivity(deps: LedgerDeps, familyId: string): Promise<Date | null> {
  return queryRepo.lastActivity(deps.db, familyId);
}

export function countTransactions(deps: LedgerDeps, familyId: string): Promise<number> {
  return queryRepo.countTransactions(deps.db, familyId);
}

/** Category and account must belong to this family (tenant isolation, NFR-06). */
export async function assertRefs(
  x: Executor,
  familyId: string,
  refs: {
    categoryId?: string | null | undefined;
    accountId?: string | null | undefined;
    toAccountId?: string | null | undefined;
  },
  /** On an edit, an account the entry already uses stays valid even if it was archived since. */
  current: { accountId?: string | null; toAccountId?: string | null } = {},
): Promise<void> {
  if (refs.categoryId && !(await catalogRepo.categoryExists(x, familyId, refs.categoryId))) {
    throw new HttpError(400, "invalid_category", "Unknown category");
  }
  for (const key of ["accountId", "toAccountId"] as const) {
    const id = refs[key];
    // Archived accounts cannot be chosen for new entries (FR-ACC-04).
    if (id && !(await catalogRepo.accountExists(x, familyId, id, { activeOnly: id !== current[key] }))) {
      throw new HttpError(400, "invalid_account", "Unknown account");
    }
  }
}
