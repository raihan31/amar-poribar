import type { Db } from "../../../platform/db.js";
import type { EventBus } from "../../../platform/events/bus.js";
import type { FamiliesFacade } from "../../families/index.js";

export interface LedgerDeps {
  db: Db;
  clock: () => Date;
  bus: EventBus;
  families: Pick<FamiliesFacade, "requireRole" | "canEditAll" | "listMemberIds" | "getUserLabels">;
}
