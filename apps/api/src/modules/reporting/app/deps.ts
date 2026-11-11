import type { FamiliesFacade } from "../../families/index.js";
import type { LedgerFacade } from "../../ledger/index.js";

export interface ReportingDeps {
  families: Pick<FamiliesFacade, "requireRole">;
  ledger: Pick<LedgerFacade, "getMonthTotals" | "remittanceByMonth" | "listForExport">;
}
