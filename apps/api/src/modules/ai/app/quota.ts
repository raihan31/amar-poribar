import { HttpError } from "../../../platform/errors.js";
import { currentDhakaMonth } from "../../ledger/index.js";
import type { AiDeps, AiFeature } from "./deps.js";

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
  /** First day (YYYY-MM-DD) of the next Dhaka month. */
  resetsOn: string;
}

/** "2026-12" → "2027-01-01". */
export function firstOfNextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** Monthly AI quota per family (FR-AI-12). Deterministic paths (SMS parser, template summary) are free. */
export async function checkQuota(deps: AiDeps, familyId: string): Promise<QuotaState> {
  const month = currentDhakaMonth(deps.clock());
  const [{ aiQuotaMonth }, used] = await Promise.all([
    deps.entitlements.get(familyId),
    deps.store.requestsUsed(familyId, month),
  ]);
  return { used, limit: aiQuotaMonth, remaining: Math.max(0, aiQuotaMonth - used), resetsOn: firstOfNextMonth(month) };
}

/** 429 `ai_quota` carrying what the app's quota card needs. */
export function quotaError(q: QuotaState): HttpError {
  return new HttpError(429, "ai_quota", "This month's AI limit has been reached", {
    used: q.used,
    limit: q.limit,
    resetsOn: q.resetsOn,
  });
}

/** 403 `plan_feature` when billing is enforced and the plan lacks the feature. */
export async function assertFeature(deps: AiDeps, familyId: string, feature: "receipt" | "ask"): Promise<void> {
  const { features } = await deps.entitlements.get(familyId);
  if (!features[feature]) throw new HttpError(403, "plan_feature", "Your plan does not include this", { feature });
}

/**
 * Runs `fn` holding one atomically reserved request, so a burst cannot overshoot the quota. Returns `null` when the
 * quota is used up (`fn` not called). A call that throws, or reports it did not use AI, gives the request back.
 */
export async function withReservation<T>(
  deps: AiDeps,
  feature: AiFeature,
  familyId: string,
  fn: () => Promise<{ value: T; usedAi: boolean }>,
): Promise<{ value: T } | null> {
  const month = currentDhakaMonth(deps.clock());
  const { aiQuotaMonth } = await deps.entitlements.get(familyId);
  if (!(await deps.store.reserve(familyId, month, feature, aiQuotaMonth))) return null;
  try {
    const { value, usedAi } = await fn();
    if (!usedAi) await deps.store.release(familyId, month, feature);
    return { value };
  } catch (err) {
    await deps.store.release(familyId, month, feature);
    throw err;
  }
}

/** Requests used in `month` and the quota, for `GET /ai/usage` and admin. */
export async function getUsage(
  deps: AiDeps,
  familyId: string,
  month: string,
): Promise<{ month: string; requests: number; quota: number }> {
  const [{ aiQuotaMonth }, requests] = await Promise.all([
    deps.entitlements.get(familyId),
    deps.store.requestsUsed(familyId, month),
  ]);
  return { month, requests, quota: aiQuotaMonth };
}
