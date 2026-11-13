import type { Db } from "../../../platform/db.js";
import type { EventBus } from "../../../platform/events/bus.js";
import type { IdentityFacade } from "../../identity/index.js";

export interface FamiliesDeps {
  db: Db;
  bus: EventBus;
  identity: Pick<IdentityFacade, "getUserBasics" | "maskPhone">;
  clock: () => Date;
  /** Base of invite links, without a trailing slash (env PUBLIC_WEB_URL). */
  publicWebUrl: string;
}
