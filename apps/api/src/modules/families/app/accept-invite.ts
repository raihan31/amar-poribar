import { HttpError } from "../../../platform/errors.js";
import { memberRepo } from "../infra/member-repo.js";
import { familiesRepo } from "../infra/families.repo.js";
import type { FamiliesDeps } from "./deps.js";

export async function acceptInvite(deps: FamiliesDeps, input: { token: string; userId: string }) {
  const now = deps.clock();
  const invite = await familiesRepo.inviteByToken(deps.db, input.token);
  if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < now.getTime()) {
    throw new HttpError(404, "not_found", "Invite not found or expired");
  }
  if (invite.phone) {
    const user = await deps.identity.getUserBasics(input.userId);
    if (user?.phone !== invite.phone) {
      throw new HttpError(403, "forbidden", "This invite is for a different phone number");
    }
  }
  await deps.db.transaction(async (tx) => {
    // The conditional update makes an invite single use even under concurrent accepts.
    if (!(await familiesRepo.markInviteAccepted(tx, invite.id, input.userId, now))) {
      throw new HttpError(404, "not_found", "Invite not found or expired");
    }
    const joined = await memberRepo.insertMember(tx, invite.familyId, input.userId, invite.role);
    if (joined) {
      await deps.bus.publish(
        tx,
        "families.MemberJoined.v1",
        { familyId: invite.familyId, userId: input.userId, role: invite.role },
        { familyId: invite.familyId },
      );
    }
  });
  return { familyId: invite.familyId, role: invite.role };
}
