import { memberRepo } from "../infra/member-repo.js";
import { familiesRepo, type FamilyRow } from "../infra/families.repo.js";
import type { FamiliesDeps } from "./deps.js";

export async function createFamily(deps: FamiliesDeps, input: { name: string; userId: string }): Promise<FamilyRow> {
  return deps.db.transaction(async (tx) => {
    const family = await familiesRepo.insertFamily(tx, input.name, input.userId);
    await memberRepo.insertMember(tx, family.id, input.userId, "owner");
    // Ledger seeds the default categories and accounts from an in-transaction subscriber of this event.
    await deps.bus.publish(
      tx,
      "families.FamilyCreated.v1",
      { familyId: family.id, createdBy: input.userId, name: input.name },
      { familyId: family.id },
    );
    return family;
  });
}
