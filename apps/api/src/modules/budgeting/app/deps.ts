import type { Db } from "../../../platform/db.js";
import type { FamiliesFacade } from "../../families/index.js";
import type { LedgerFacade } from "../../ledger/index.js";

export interface BudgetingDeps {
  db: Db;
  families: Pick<FamiliesFacade, "requireRole">;
  ledger: Pick<LedgerFacade, "monthTotals" | "expenseTotalBetween" | "listCategories">;
}
