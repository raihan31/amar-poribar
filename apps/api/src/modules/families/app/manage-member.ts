import type { Role } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { canAssignRole, canManageMember } from "../domain/roles.js";
import { familiesRepo } from "../infra/families.repo.js";
import type { FamiliesDeps } from "./deps.js";
import { requireRole } from "./require-role.js";

async function currentRole(deps: FamiliesDeps, familyId: string, userId: string): Promise<Role> {
  const role = await familiesRepo.memberRole(deps.db, familyId, userId);
  if (!role) throw new HttpError(404, "not_found", "Member not found");
  return role;
}

// FR-FAM-03: change roles.
export async function changeMemberRole(
  deps: FamiliesDeps,
  input: { familyId: string; actorId: string; userId: string; role: Role },
) {
  const actor = await requireRole(deps.db, input.familyId, input.actorId, "admin");
  const current = await currentRole(deps, input.familyId, input.userId);
  if (!canManageMember(actor, current) || !canAssignRole(actor, input.role)) {
    throw new HttpError(403, "forbidden", "Insufficient role");
  }
  await familiesRepo.setRole(deps.db, input.familyId, input.userId, input.role);
  return { userId: input.userId, role: input.role };
}

// FR-FAM-03: remove members (or leave).
export async function removeMember(deps: FamiliesDeps, input: { familyId: string; actorId: string; userId: string }) {
  const isSelf = input.userId === input.actorId;
  const actor = await requireRole(deps.db, input.familyId, input.actorId, isSelf ? "viewer" : "admin");
  const current = await currentRole(deps, input.familyId, input.userId);
  if (current === "owner") throw new HttpError(403, "forbidden", "The owner cannot be removed");
  if (!isSelf && !canManageMember(actor, current)) throw new HttpError(403, "forbidden", "Insufficient role");
  await deps.db.transaction(async (tx) => {
    await familiesRepo.deleteMember(tx, input.familyId, input.userId);
    await deps.bus.publish(
      tx,
      "families.MemberRemoved.v1",
      { familyId: input.familyId, userId: input.userId },
      { familyId: input.familyId },
    );
  });
}
