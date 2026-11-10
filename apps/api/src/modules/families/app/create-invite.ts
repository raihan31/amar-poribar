import { randomBytes } from "node:crypto";
import { normalizeBdPhone, type Role } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { canAssignRole } from "../domain/roles.js";
import { familiesRepo } from "../infra/families.repo.js";
import type { FamiliesDeps } from "./deps.js";
import { requireRole } from "./require-role.js";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// FR-FAM-02: Owner/Admin invites by phone number or shareable link.
export async function createInvite(
  deps: FamiliesDeps,
  input: { familyId: string; actorId: string; role: Role; phone?: string | undefined },
) {
  const actor = await requireRole(deps.db, input.familyId, input.actorId, "admin");
  if (!canAssignRole(actor, input.role)) throw new HttpError(403, "forbidden", "Cannot invite with this role");
  const invite = await familiesRepo.insertInvite(deps.db, {
    familyId: input.familyId,
    token: randomBytes(24).toString("base64url"),
    role: input.role,
    phone: input.phone ? normalizeBdPhone(input.phone) : null,
    createdBy: input.actorId,
    expiresAt: new Date(deps.clock().getTime() + INVITE_TTL_MS),
  });
  return { token: invite.token, role: invite.role, phone: invite.phone, expiresAt: invite.expiresAt };
}
