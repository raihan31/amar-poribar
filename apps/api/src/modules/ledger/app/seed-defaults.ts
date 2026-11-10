import type { Tx } from "../../../platform/events/bus.js";
import { catalogRepo } from "../infra/catalog.repo.js";

/** Runs inside the family-creation transaction: if it fails, the family is not created either. */
export function seedDefaults(tx: Tx, familyId: string, ownerUserId: string | null): Promise<void> {
  return catalogRepo.seedDefaults(tx, familyId, ownerUserId);
}
