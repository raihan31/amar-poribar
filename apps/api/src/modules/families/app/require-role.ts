import type { Role } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { hasRole } from "../domain/roles.js";
import { familiesRepo } from "../infra/families.repo.js";
import { memberRepo, type Executor, type FamilySummary } from "../infra/member-repo.js";

export const SUSPENDED_MESSAGE_BN = "এই পরিবারের হিসাব এখন শুধু দেখা যাবে";
export const SUSPENDED_MESSAGE_EN = "This family's accounts are read-only right now";

export interface RequireRoleOpts {
  /** The caller intends to change data; a suspended family answers 423 `family_suspended` (FR-FAM-09). */
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
  if (opts.write && (await familiesRepo.status(x, familyId)) === "suspended") {
    throw new HttpError(423, "family_suspended", SUSPENDED_MESSAGE_BN, { message_en: SUSPENDED_MESSAGE_EN });
  }
  return { role: family.role, family };
}
