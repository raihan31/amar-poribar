import type { Db } from "../../../platform/db.js";
import type { EventBus } from "../../../platform/events/bus.js";
import type { IdentityFacade } from "../../identity/index.js";

export interface FamiliesDeps {
  db: Db;
  bus: EventBus;
  identity: Pick<IdentityFacade, "getUserBasics">;
  clock: () => Date;
}
