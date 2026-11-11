import { memberRepo } from "../infra/member-repo.js";
import type { FamiliesDeps } from "./deps.js";
import { requireRole } from "./require-role.js";

/** Names and phones come from identity; families keeps only ids and roles. */
export async function listMembers(deps: FamiliesDeps, input: { familyId: string; actorId: string }) {
  await requireRole(deps.db, input.familyId, input.actorId, "viewer");
  const members = await memberRepo.listMembers(deps.db, input.familyId);
  const users = await Promise.all(members.map((m) => deps.identity.getUserBasics(m.userId)));
  return members.map((m, i) => ({
    userId: m.userId,
    role: m.role,
    name: users[i]?.name ?? null,
    phone: users[i]?.phone ?? null,
  }));
}
