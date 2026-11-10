// Role rules live in modules/families. Routes that have not moved into a module yet (T-PLAT-25..30) still call
// these thin wrappers; each moved route uses `ctx.facades.families.requireRole` instead.
import type { Role } from "@amar-poribar/shared";
import type { Db } from "./db/client.js";
import {
  canAssignRole,
  canEditAll,
  canManageMember,
  findMemberRoleWithDb,
  requireRoleWithDb,
} from "./modules/families/index.js";

export { canAssignRole, canEditAll, canManageMember };

export function requireRole(db: Db, familyId: string, userId: string, minRole: Role): Promise<Role> {
  return requireRoleWithDb(db, familyId, userId, minRole);
}

export function findMemberRole(db: Db, familyId: string, userId: string): Promise<Role | null> {
  return findMemberRoleWithDb(db, familyId, userId);
}
