import { canEditAll } from "../domain/roles.js";
import { memberRepo } from "../infra/member-repo.js";
import type { FamiliesDeps } from "./deps.js";
import { requireRole } from "./require-role.js";

/**
 * Names and phones come from identity; families keeps only ids, roles and join dates.
 * Phones go to owner and admin callers only; everyone else gets `phone: null` (privacy inside families).
 */
export async function listMembers(deps: FamiliesDeps, input: { familyId: string; actorId: string }) {
  const { role: actorRole } = await requireRole(deps.db, input.familyId, input.actorId, "viewer");
  const showPhone = canEditAll(actorRole);
  const members = await memberRepo.listMembersWithJoined(deps.db, input.familyId);
  const users = await Promise.all(members.map((m) => deps.identity.getUserBasics(m.userId)));
  return members.map((m, i) => {
    const user = users[i];
    const name = user?.name ?? null;
    const phone = user?.phone ?? null;
    return {
      userId: m.userId,
      name,
      displayName: name ?? (phone ? deps.identity.maskPhone(phone) : ""),
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      isYou: m.userId === input.actorId,
      phone: showPhone ? phone : null,
    };
  });
}
