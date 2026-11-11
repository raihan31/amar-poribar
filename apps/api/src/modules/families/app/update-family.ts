import type { Role } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { familiesRepo, type FamilyRow } from "../infra/families.repo.js";
import { memberRepo } from "../infra/member-repo.js";
import type { FamiliesDeps } from "./deps.js";
import { requireRole } from "./require-role.js";

export type FamilyView = FamilyRow & { memberCount: number; myRole: Role };

async function view(deps: FamiliesDeps, family: FamilyRow, myRole: Role): Promise<FamilyView> {
  return { ...family, memberCount: await memberRepo.countMembers(deps.db, family.id), myRole };
}

/** `GET /v1/families/:id`: any member, including viewers. */
export async function getFamily(deps: FamiliesDeps, input: { familyId: string; actorId: string }): Promise<FamilyView> {
  const { role } = await requireRole(deps.db, input.familyId, input.actorId, "viewer");
  const family = await familiesRepo.familyById(deps.db, input.familyId);
  if (!family) throw new HttpError(404, "not_found", "Family not found");
  return view(deps, family, role);
}

/** `PATCH /v1/families/:id`: owner or admin; only the name is editable here. */
export async function updateFamily(
  deps: FamiliesDeps,
  input: { familyId: string; actorId: string; name: string },
): Promise<FamilyView> {
  const { role } = await requireRole(deps.db, input.familyId, input.actorId, "admin", { write: true });
  const family = await familiesRepo.rename(deps.db, input.familyId, input.name, deps.clock());
  if (!family) throw new HttpError(404, "not_found", "Family not found");
  return view(deps, family, role);
}
