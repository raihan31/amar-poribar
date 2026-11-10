import { HttpError } from "../../../platform/errors.js";
import { catalogRepo, type Executor } from "../infra/catalog.repo.js";

/** Category and account must belong to this family (tenant isolation, NFR-06). */
export async function assertOwnedRefs(
  x: Executor,
  familyId: string,
  refs: { categoryId?: string | null | undefined; accountId?: string | null | undefined },
): Promise<void> {
  if (refs.categoryId && !(await catalogRepo.categoryExists(x, familyId, refs.categoryId))) {
    throw new HttpError(400, "invalid_category", "Unknown category");
  }
  if (refs.accountId && !(await catalogRepo.accountExists(x, familyId, refs.accountId))) {
    throw new HttpError(400, "invalid_account", "Unknown account");
  }
}
