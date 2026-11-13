import type { AskTools } from "@amar-poribar/ai";
import type { LedgerFacade } from "../../ledger/index.js";

/** Ask's read-only tools, backed by the ledger's visibility-aware queries. */
export function buildAskTools(ledger: Pick<LedgerFacade, "askQueries">, familyId: string, userId: string): AskTools {
  return ledger.askQueries(familyId, userId);
}
