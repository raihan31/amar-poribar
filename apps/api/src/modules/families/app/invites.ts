import { randomBytes } from "node:crypto";
import { normalizeBdPhone, type Role } from "@amar-poribar/shared";
import type { Db } from "../../../platform/db.js";
import { HttpError } from "../../../platform/errors.js";
import { INVITE_RETENTION_MS, INVITE_TTL_MS, inviteState } from "../domain/invite.js";
import { canAssignRole } from "../domain/roles.js";
import { familiesRepo } from "../infra/families.repo.js";
import { memberRepo, type Executor } from "../infra/member-repo.js";
import type { FamiliesDeps } from "./deps.js";
import { requireRole } from "./require-role.js";

const notFound = () => new HttpError(404, "invite_not_found", "Invite not found");

/** FR-FAM-10: the limit comes from the plan (kept current by billing events). Removing members never blocks. */
async function assertCapacity(x: Executor, familyId: string) {
  const family = await familiesRepo.familyById(x, familyId);
  if (!family) throw notFound();
  if ((await memberRepo.countMembers(x, familyId)) >= family.memberLimit) {
    throw new HttpError(409, "plan_member_limit", "This family has reached its member limit", {
      limit: family.memberLimit,
    });
  }
}

// FR-FAM-02: Owner/Admin invites by phone number or shareable link.
export async function createInvite(
  deps: FamiliesDeps,
  input: { familyId: string; actorId: string; role: Role; phone?: string | undefined },
) {
  const { role: actor } = await requireRole(deps.db, input.familyId, input.actorId, "admin", { write: true });
  if (!canAssignRole(actor, input.role)) throw new HttpError(403, "forbidden", "Cannot invite with this role");
  const invite = await deps.db.transaction(async (tx) => {
    await assertCapacity(tx, input.familyId);
    const row = await familiesRepo.insertInvite(tx, {
      familyId: input.familyId,
      token: randomBytes(24).toString("base64url"),
      role: input.role,
      phone: input.phone ? normalizeBdPhone(input.phone) : null,
      createdBy: input.actorId,
      expiresAt: new Date(deps.clock().getTime() + INVITE_TTL_MS),
    });
    // FR-FAM-06: a phone invite is delivered by the InviteCreated handler (inbox item or SMS).
    if (row.phone) {
      await deps.bus.publish(
        tx,
        "families.InviteCreated.v1",
        {
          inviteId: row.id,
          familyId: row.familyId,
          token: row.token,
          phone: row.phone,
          role: row.role,
          inviterUserId: input.actorId,
          expiresAt: row.expiresAt.toISOString(),
        },
        { familyId: row.familyId },
      );
    }
    return row;
  });
  return {
    id: invite.id,
    token: invite.token,
    role: invite.role,
    phone: invite.phone,
    expiresAt: invite.expiresAt,
    link: `${deps.publicWebUrl}/join/${invite.token}`,
  };
}

/** Public preview for screen A6/F6. Exposes only the family name, a head count and the inviter's display name. */
export async function previewInvite(deps: FamiliesDeps, token: string) {
  const invite = await familiesRepo.inviteByToken(deps.db, token);
  if (!invite) throw notFound();
  const [family, memberCount, inviter] = await Promise.all([
    familiesRepo.familyById(deps.db, invite.familyId),
    memberRepo.countMembers(deps.db, invite.familyId),
    deps.identity.getUserBasics(invite.createdBy),
  ]);
  if (!family) throw notFound();
  return {
    familyName: family.name,
    memberCount,
    invitedBy: { name: inviter?.name ?? "" },
    role: invite.role,
    expiresAt: invite.expiresAt,
    state: inviteState(invite, deps.clock()),
    ...(invite.phone ? { forPhoneMasked: deps.identity.maskPhone(invite.phone) } : {}),
  };
}

export async function acceptInvite(deps: FamiliesDeps, input: { token: string; userId: string }) {
  const now = deps.clock();
  const invite = await familiesRepo.inviteByToken(deps.db, input.token);
  if (!invite) throw notFound();

  const existing = await memberRepo.memberRole(deps.db, invite.familyId, input.userId);
  if (existing) return { familyId: invite.familyId, role: existing, alreadyMember: true };

  const state = inviteState(invite, now);
  if (state === "revoked") throw new HttpError(410, "invite_revoked", "This invite was cancelled");
  if (state === "used") throw new HttpError(409, "invite_used", "This invite was already used");
  if (state === "expired") throw new HttpError(410, "invite_expired", "This invite has expired");

  if (invite.phone) {
    const user = await deps.identity.getUserBasics(input.userId);
    if (user?.phone !== invite.phone) {
      throw new HttpError(403, "invite_wrong_phone", "This invite is for a different phone number");
    }
  }

  const family = await familiesRepo.familyById(deps.db, invite.familyId);
  if (!family) throw notFound();

  await deps.db.transaction(async (tx) => {
    await assertCapacity(tx, invite.familyId);
    // The conditional update makes an invite single use even under concurrent accepts.
    if (!(await familiesRepo.markInviteAccepted(tx, invite.id, input.userId, now))) {
      throw new HttpError(409, "invite_used", "This invite was already used");
    }
    const joined = await memberRepo.insertMember(tx, invite.familyId, input.userId, invite.role);
    if (joined) {
      await deps.bus.publish(
        tx,
        "families.MemberJoined.v1",
        { familyId: invite.familyId, userId: input.userId, role: invite.role, invitedBy: invite.createdBy },
        { familyId: invite.familyId },
      );
    }
  });
  return { familyId: invite.familyId, role: invite.role };
}

/** Pending invites. The token is shown only to the admin who created the invite. */
export async function listInvites(deps: FamiliesDeps, input: { familyId: string; actorId: string }) {
  await requireRole(deps.db, input.familyId, input.actorId, "admin");
  const rows = await familiesRepo.listPendingInvites(deps.db, input.familyId, deps.clock());
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    ...(r.phone ? { forPhoneMasked: deps.identity.maskPhone(r.phone) } : {}),
    ...(r.createdBy === input.actorId ? { token: r.token, link: `${deps.publicWebUrl}/join/${r.token}` } : {}),
  }));
}

export async function revokeInvite(deps: FamiliesDeps, input: { familyId: string; inviteId: string; actorId: string }) {
  await requireRole(deps.db, input.familyId, input.actorId, "admin", { write: true });
  if (!(await familiesRepo.revokeInvite(deps.db, input.familyId, input.inviteId, deps.clock()))) throw notFound();
}

/** Job `families.purge-invites`: drops invites that expired or were revoked more than 30 days ago. */
export async function purgeInvites(db: Db, now: Date): Promise<number> {
  return familiesRepo.purgeInvites(db, new Date(now.getTime() - INVITE_RETENTION_MS));
}
