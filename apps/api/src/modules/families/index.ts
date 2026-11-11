import type { Role } from "@amar-poribar/shared";
import { HttpError } from "../../platform/errors.js";
import type { ModuleDefinition } from "../../platform/module.js";
import { onInviteCreated } from "./app/on-invite-created.js";
import type { InvitePorts } from "./app/ports.js";
import { requireRole } from "./app/require-role.js";
import { canAssignRole, canEditAll, canManageMember } from "./domain/roles.js";
import { familiesRoutes } from "./http/families.routes.js";
import { invitesRoutes } from "./http/invite-routes.js";
import { purgeInvitesJob } from "./jobs.js";
import { membersRoutes } from "./http/members.routes.js";
import { familiesRepo } from "./infra/families.repo.js";
import { memberRepo, type FamilySummary, type MembershipSummary } from "./infra/member-repo.js";
export * from "./events.js";

export type { FamilySummary, MembershipSummary, InvitePorts };
export { canAssignRole, canEditAll, canManageMember };

/** Public surface of the families module. Other modules may import only this file (SRS R1). */
export interface FamiliesFacade {
  readonly name: "families";
  /** 404 for non-members, 403 for an insufficient role. */
  requireRole(
    familyId: string,
    userId: string,
    minRole: Role,
    opts?: { write?: boolean },
  ): Promise<{ role: Role; family: FamilySummary }>;
  /** The user's families with role, status, member limit and member count (family switcher, F2). */
  listMemberships(userId: string): Promise<MembershipSummary[]>;
  listMemberIds(familyId: string): Promise<string[]>;
  isMember(familyId: string, userId: string): Promise<boolean>;
  getMemberRoles(familyId: string): Promise<Map<string, Role>>;
  /** Display name (else phone) per user id; ids without a user are absent. Ledger uses it for member breakdowns. */
  getUserLabels(userIds: readonly string[]): Promise<Map<string, string>>;
  /** Temporary home; moves to billing in T-BILL. */
  getAiQuota(familyId: string): Promise<{ quotaMonth: number; plan: string }>;
  canEditAll(role: Role): boolean;
  canAssignRole(actor: Role, target: Role): boolean;
  canManageMember(actor: Role, current: Role): boolean;
  /** Called by notifications at registration to supply `notify` for invite delivery (families imports neither). */
  bindInvitePorts(ports: Pick<InvitePorts, "notify">): void;
}

declare module "../../platform/module.js" {
  interface Facades {
    families: FamiliesFacade;
  }
}

export const familiesModule: ModuleDefinition<FamiliesFacade> = {
  name: "families",
  dependsOn: ["identity"],
  register(app, ctx) {
    const identity = ctx.facades.identity;
    if (!identity) throw new Error("families: identity must be registered first");
    const bus = ctx.bus;
    const publicWebUrl = (ctx.config as { publicWebUrl?: string } | undefined)?.publicWebUrl ?? "http://localhost:3000";
    const deps = { db: ctx.db, bus, identity, clock: ctx.clock, publicWebUrl };
    let notify: InvitePorts["notify"] | undefined;
    const invitePorts = (): InvitePorts | undefined =>
      notify
        ? {
            notify,
            smsSend: async (phone, text) => {
              await ctx.ports.sms.send({ to: phone, text, kind: "invite" });
            },
          }
        : undefined;
    ctx.bus.on("families.InviteCreated.v1", "families.deliver-invite", (e) =>
      onInviteCreated({ db: ctx.db, identity, ports: invitePorts, publicWebUrl }, e),
    );
    ctx.jobs.register(purgeInvitesJob({ db: ctx.db, clock: ctx.clock }));
    familiesRoutes(app, deps);
    invitesRoutes(app, deps);
    membersRoutes(app, deps);
    return {
      name: "families",
      requireRole: (familyId, userId, minRole, opts) => requireRole(ctx.db, familyId, userId, minRole, opts),
      listMemberships: (userId) => memberRepo.listForUser(ctx.db, userId),
      async listMemberIds(familyId) {
        return (await memberRepo.listMembers(ctx.db, familyId)).map((m) => m.userId);
      },
      async isMember(familyId, userId) {
        return (await memberRepo.memberRole(ctx.db, familyId, userId)) !== null;
      },
      async getMemberRoles(familyId) {
        return new Map((await memberRepo.listMembers(ctx.db, familyId)).map((m) => [m.userId, m.role]));
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
      bindInvitePorts: (ports) => {
        notify = ports.notify;
      },
    };
  },
};
