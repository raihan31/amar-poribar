import type { Role } from "@amar-poribar/shared";
import { HttpError } from "../../platform/errors.js";
import type { Db } from "../../platform/db.js";
import type { ModuleDefinition } from "../../platform/module.js";
import { requireRole } from "./app/require-role.js";
import { canAssignRole, canEditAll, canManageMember } from "./domain/roles.js";
import { familiesRoutes } from "./http/families.routes.js";
import { invitesRoutes } from "./http/invites.routes.js";
import { membersRoutes } from "./http/members.routes.js";
import { familiesRepo, type FamilySummary } from "./infra/families.repo.js";
export * from "./events.js";

export type { FamilySummary };
export { canAssignRole, canEditAll, canManageMember };

/** Public surface of the families module. Other modules may import only this file (SRS R1). */
export interface FamiliesFacade {
  readonly name: "families";
  /** 404 for non-members, 403 for an insufficient role. */
  requireRole(familyId: string, userId: string, minRole: Role): Promise<Role>;
  listFamiliesForUser(userId: string): Promise<FamilySummary[]>;
  getMemberIds(familyId: string): Promise<string[]>;
  getMemberRoles(familyId: string): Promise<Map<string, Role>>;
  /** Display name (else phone) per user id; ids without a user are absent. Ledger uses it for member breakdowns. */
  getUserLabels(userIds: readonly string[]): Promise<Map<string, string>>;
  /** Temporary home; moves to billing in T-BILL. */
  getAiQuota(familyId: string): Promise<{ quotaMonth: number; plan: string }>;
  canEditAll(role: Role): boolean;
  canAssignRole(actor: Role, target: Role): boolean;
  canManageMember(actor: Role, current: Role): boolean;
}

declare module "../../platform/module.js" {
  interface Facades {
    families: FamiliesFacade;
  }
}

/**
 * Role check for routes that have not moved into a module yet and only hold a `Db`.
 * Removed once the last legacy route moves (T-PLAT-25..30).
 */
export function requireRoleWithDb(db: Db, familyId: string, userId: string, minRole: Role): Promise<Role> {
  return requireRole(db, familyId, userId, minRole);
}

/** Legacy-route counterpart of `requireRoleWithDb`: the member's role, or null. */
export function findMemberRoleWithDb(db: Db, familyId: string, userId: string): Promise<Role | null> {
  return familiesRepo.memberRole(db, familyId, userId);
}

export const familiesModule: ModuleDefinition<FamiliesFacade> = {
  name: "families",
  dependsOn: ["identity"],
  register(app, ctx) {
    const identity = ctx.facades.identity;
    if (!identity) throw new Error("families: identity must be registered first");
    const bus = ctx.bus;
    const deps = { db: ctx.db, bus, identity, clock: ctx.clock };
    familiesRoutes(app, deps);
    invitesRoutes(app, deps);
    membersRoutes(app, deps);
    return {
      name: "families",
      requireRole: (familyId, userId, minRole) => requireRole(ctx.db, familyId, userId, minRole),
      listFamiliesForUser: (userId) => familiesRepo.listForUser(ctx.db, userId),
      async getMemberIds(familyId) {
        return (await familiesRepo.listMembers(ctx.db, familyId)).map((m) => m.userId);
      },
      async getMemberRoles(familyId) {
        return new Map((await familiesRepo.listMembers(ctx.db, familyId)).map((m) => [m.userId, m.role]));
      },
      async getUserLabels(userIds) {
        const users = await Promise.all([...new Set(userIds)].map((id) => identity.getUserBasics(id)));
        const labels = new Map<string, string>();
        for (const u of users) {
          const label = u?.name ?? u?.phone;
          if (u && label) labels.set(u.id, label);
        }
        return labels;
      },
      async getAiQuota(familyId) {
        const q = await familiesRepo.aiQuota(ctx.db, familyId);
        if (!q) throw new HttpError(404, "not_found", "Family not found");
        return q;
      },
      canEditAll,
      canAssignRole,
      canManageMember,
    };
  },
};
