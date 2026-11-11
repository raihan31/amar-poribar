import { HttpError } from "../../../platform/errors.js";
import { familiesRepo } from "../infra/families.repo.js";
import { memberRepo } from "../infra/member-repo.js";
import type { FamiliesDeps } from "./deps.js";
import { requireRole } from "./require-role.js";

export interface TransferActor {
  kind: "user" | "staff";
  id: string;
}

/**
 * FR-FAM-07: hand the family to another member. A user (the owner) may only pick an admin; staff may pick any
 * member. Both role changes and the event happen in one transaction, so a family never has two owners.
 */
export async function transferOwnership(
  deps: Pick<FamiliesDeps, "db" | "bus">,
  input: { familyId: string; toUserId: string; actor: TransferActor },
): Promise<{ familyId: string; owner: string }> {
  const { familyId, toUserId, actor } = input;
  if (actor.kind === "user") await requireRole(deps.db, familyId, actor.id, "owner");

  return deps.db.transaction(async (tx) => {
    // Serialise concurrent transfers on this family, then read roles under the lock.
    if (!(await familiesRepo.lock(tx, familyId))) throw new HttpError(404, "not_found", "Family not found");
    const members = await memberRepo.listMembers(tx, familyId);
    const target = members.find((m) => m.userId === toUserId);
    if (!target) throw new HttpError(404, "not_found", "Member not found");
    const owners = members.filter((m) => m.role === "owner");
    if (actor.kind === "user" && !owners.some((o) => o.userId === actor.id)) {
      throw new HttpError(403, "forbidden", "Only the owner can transfer ownership");
    }
    if (actor.kind === "user" ? target.role !== "admin" : target.role === "owner") {
      if (actor.kind === "staff" && owners.length === 1) return { familyId, owner: toUserId };
      throw new HttpError(409, "target_not_admin", "The new owner must be an admin of the family");
    }
    const from = owners[0]?.userId ?? actor.id;
    for (const o of owners) await memberRepo.setRole(tx, familyId, o.userId, "admin");
    await memberRepo.setRole(tx, familyId, toUserId, "owner");
    await deps.bus.publish(
      tx,
      "families.OwnershipTransferred.v1",
      { familyId, fromUserId: from, toUserId, by: actor.kind === "staff" ? "staff" : "owner" },
      { familyId },
    );
    return { familyId, owner: toUserId };
  });
}
