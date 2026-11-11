import { HttpError } from "../../../platform/errors.js";
import { familiesRepo } from "../infra/families.repo.js";
import type { FamiliesDeps } from "./deps.js";
import type { TransferActor } from "./transfer-ownership.js";

type Deps = Pick<FamiliesDeps, "db" | "bus" | "clock">;

/** @staff-safe FR-FAM-09. Idempotent: suspending a suspended family refreshes the reason and publishes again. */
export async function suspendFamily(deps: Deps, familyId: string, reason: string, actor: TransferActor): Promise<void> {
  void actor; // audit trail arrives with the admin module (T-ADM)
  await deps.db.transaction(async (tx) => {
    const prev = await familiesRepo.setSuspension(tx, familyId, {
      status: "suspended",
      suspendedAt: deps.clock(),
      suspendedReason: reason,
    });
    if (prev === null) throw new HttpError(404, "not_found", "Family not found");
    await deps.bus.publish(tx, "families.FamilySuspended.v1", { familyId, reason }, { familyId });
  });
}

/** @staff-safe FR-FAM-09. */
export async function unsuspendFamily(deps: Deps, familyId: string, actor: TransferActor): Promise<void> {
  void actor; // audit trail arrives with the admin module (T-ADM)
  await deps.db.transaction(async (tx) => {
    const prev = await familiesRepo.setSuspension(tx, familyId, {
      status: "active",
      suspendedAt: null,
      suspendedReason: null,
    });
    if (prev === null) throw new HttpError(404, "not_found", "Family not found");
    await deps.bus.publish(tx, "families.FamilyUnsuspended.v1", { familyId }, { familyId });
  });
}
