import type { Role } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { hasRole } from "../domain/roles.js";
import { familiesRepo, type Executor } from "../infra/families.repo.js";

/**
 * Ensure the user belongs to the family with at least `minRole`.
 * Non-members get 404 so family IDs can't be probed (SRS acceptance #7).
 */
export async function requireRole(x: Executor, familyId: string, userId: string, minRole: Role): Promise<Role> {
  const role = await familiesRepo.memberRole(x, familyId, userId);
  if (!role) throw new HttpError(404, "not_found", "Family not found");
  if (!hasRole(role, minRole)) throw new HttpError(403, "forbidden", "Insufficient role");
  return role;
}
