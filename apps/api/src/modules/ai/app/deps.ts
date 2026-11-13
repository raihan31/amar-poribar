import type { FamiliesFacade } from "../../families/index.js";
import type { LedgerFacade } from "../../ledger/index.js";
import type { ClaudeClient } from "../infra/claude-client.js";
import type { EntitlementsPort } from "./entitlements-port.js";

/** Features that may appear in `ai.ai_usage.feature`; `legacy` holds rows from before metering. */
export const AI_FEATURES = ["parse", "receipt", "ask", "summary", "legacy"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export interface MeteringDelta {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  latencyMsSum: number;
  errors: number;
}

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
  /** Atomically takes one request for `feature` unless the month's total has reached `limit`. */
  reserve(familyId: string, month: string, feature: AiFeature, limit: number): Promise<boolean>;
  /** Gives back one reserved request (a failed call must not burn quota). */
  release(familyId: string, month: string, feature: AiFeature): Promise<void>;
  /** Adds one metering delta to the family's row for `month` and `feature` in a single statement. */
  recordMetering(familyId: string, month: string, feature: AiFeature, delta: MeteringDelta): Promise<void>;
  findSummary(key: SummaryKey): Promise<CachedSummary | null>;
  saveSummary(key: SummaryKey, value: CachedSummary): Promise<void>;
}

export interface AiDeps {
  store: AiStore;
  families: Pick<FamiliesFacade, "requireRole">;
  entitlements: EntitlementsPort;
  ledger: Pick<LedgerFacade, "listCategories" | "getMonthTotals" | "askQueries">;
  /** Not enabled when no API key is configured; only deterministic paths run then. */
  claude: ClaudeClient;
  clock: () => Date;
}
