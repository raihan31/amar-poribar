import type { Role } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { hasRole } from "../domain/roles.js";
import { memberRepo, type Executor, type FamilySummary } from "../infra/member-repo.js";

export interface RequireRoleOpts {
  /** The caller intends to change data; a suspended family answers 423 (status column arrives in T-FAM-08). */
  write?: boolean;
}

/**
 * Ensure the user belongs to the family with at least `minRole`.
 * Non-members get 404 so family IDs can't be probed (SRS acceptance #7).
 */
export async function requireRole(
  x: Executor,
  familyId: string,
  userId: string,
  minRole: Role,
  opts: RequireRoleOpts = {},
): Promise<{ role: Role; family: FamilySummary }> {
  const family = await memberRepo.membership(x, familyId, userId);
  if (!family) throw new HttpError(404, "not_found", "Family not found");
  if (!hasRole(family.role, minRole)) throw new HttpError(403, "forbidden", "Insufficient role");
  // T-FAM-08 adds families.status; until then there is nothing to check, so opts.write is a no-op.
  void opts.write;
  return { role: family.role, family };
}
