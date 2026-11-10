import type { Role } from "@amar-poribar/shared";

export const ROLE_RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

export function hasRole(actual: Role, min: Role): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[min];
}

export function canEditAll(role: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.admin;
}

/** Roles that `actor` may assign to others. Only owners can create admins; nobody assigns owner. */
export function canAssignRole(actor: Role, target: Role): boolean {
  if (target === "owner") return false;
  if (target === "admin") return actor === "owner";
  return ROLE_RANK[actor] >= ROLE_RANK.admin;
}

/** Whether `actor` may change or remove a member currently holding `current`. */
export function canManageMember(actor: Role, current: Role): boolean {
  if (current === "owner") return false;
  if (current === "admin") return actor === "owner";
  return ROLE_RANK[actor] >= ROLE_RANK.admin;
}
