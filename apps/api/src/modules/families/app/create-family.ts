import { familiesRepo, type FamilyRow } from "../infra/families.repo.js";
import type { FamiliesDeps } from "./deps.js";
import { legacySeed } from "./legacy-seed.js";

export async function createFamily(deps: FamiliesDeps, input: { name: string; userId: string }): Promise<FamilyRow> {
  const seed = deps.seedDefaults ?? legacySeed;
  return deps.db.transaction(async (tx) => {
    const family = await familiesRepo.insertFamily(tx, input.name, input.userId);
    await familiesRepo.insertMember(tx, family.id, input.userId, "owner");
    // Ledger's in-transaction subscriber replaces this call in T-PLAT-25.
    await seed(tx, { familyId: family.id, userId: input.userId });
    await deps.bus.publish(
      tx,
      "families.FamilyCreated.v1",
      { familyId: family.id, createdBy: input.userId, name: input.name },
      { familyId: family.id },
    );
    return family;
  });
}
