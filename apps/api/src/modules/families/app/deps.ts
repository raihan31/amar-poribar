import type { Db } from "../../../platform/db.js";
import type { EventBus, Tx } from "../../../platform/events/bus.js";
import type { IdentityFacade } from "../../identity/index.js";

/** Seeds a new family's categories and accounts inside the creating transaction. Provided by `ledger` (T-PLAT-25). */
export type SeedDefaults = (tx: Tx, input: { familyId: string; userId: string }) => Promise<void>;

export interface FamiliesDeps {
  db: Db;
  bus: EventBus;
  identity: Pick<IdentityFacade, "getUserBasics">;
  clock: () => Date;
  seedDefaults?: SeedDefaults;
}
