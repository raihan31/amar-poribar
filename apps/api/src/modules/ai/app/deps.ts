import type { FamiliesFacade } from "../../families/index.js";
import type { LedgerFacade } from "../../ledger/index.js";
import type { ClaudeClient } from "../infra/claude-client.js";

export interface SummaryKey {
  familyId: string;
  month: string;
  locale: string;
  factsHash: string;
}

export interface CachedSummary {
  text: string;
  speechText: string;
  usedAi: boolean;
}

/** Persistence this module needs; the DB implementation is `infra/store.ts`. */
export interface AiStore {
  requestsUsed(familyId: string, month: string): Promise<number>;
  /** Adds one request to the family's count for `month`. */
  recordUse(familyId: string, month: string): Promise<void>;
  findSummary(key: SummaryKey): Promise<CachedSummary | null>;
  saveSummary(key: SummaryKey, value: CachedSummary): Promise<void>;
}

export interface AiDeps {
  store: AiStore;
  families: Pick<FamiliesFacade, "requireRole" | "getAiQuota">;
  ledger: Pick<LedgerFacade, "listCategories" | "getMonthTotals" | "askQueries">;
  /** Not enabled when no API key is configured; only deterministic paths run then. */
  claude: ClaudeClient;
  clock: () => Date;
}
