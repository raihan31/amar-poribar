import { currentDhakaMonth } from "../../ledger/index.js";
import type { AiDeps } from "./deps.js";

/** Monthly AI quota per family (FR-AI-12). Deterministic paths (SMS parser, template summary) are free. */
export async function hasAiQuota(deps: AiDeps, familyId: string): Promise<boolean> {
  const month = currentDhakaMonth(deps.clock());
  const [{ quotaMonth }, used] = await Promise.all([
    deps.families.getAiQuota(familyId),
    deps.store.requestsUsed(familyId, month),
  ]);
  return quotaMonth > used;
}

/** Requests used in `month` and the quota, for `GET /ai/usage` and admin. */
export async function getUsage(
  deps: AiDeps,
  familyId: string,
  month: string,
): Promise<{ month: string; requests: number; quota: number }> {
  const [{ quotaMonth }, requests] = await Promise.all([
    deps.families.getAiQuota(familyId),
    deps.store.requestsUsed(familyId, month),
  ]);
  return { month, requests, quota: quotaMonth };
}
