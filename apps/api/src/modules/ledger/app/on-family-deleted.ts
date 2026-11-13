import type { ObjectStorage } from "../../../platform/storage/storage.js";
import type { Executor } from "../infra/catalog.repo.js";
import { queryRepo } from "../infra/query-repo.js";

/** `families.FamilyDeleted.v1`: remove the family's ledger rows and receipt objects. Safe to run twice. */
export async function onFamilyDeleted(x: Executor, storage: ObjectStorage, familyId: string): Promise<void> {
  await queryRepo.deleteFamilyRows(x, familyId);
  await storage.deleteMany(`receipt/${familyId}/`);
}
