import { HttpError } from "../../../platform/errors.js";
import type { Db } from "../../../platform/db.js";
import { getOverride, upsertOverride } from "../infra/overrides-repo.js";
import { listPlanLimits } from "../infra/catalogue-repo.js";
import { toLimits, type PlanLimits } from "./catalogue.js";

export type PlanId = "free" | "plus" | "probashi";
export type SubscriptionState = "active" | "past_due" | "canceled_at_period_end" | "expired" | "none";
export type FeatureKey = "receiptVision" | "ask" | "exportBeyondCsv" | "multiCurrency" | "remittancePlanner";

export interface Entitlements {
  planId: PlanId;
  state: SubscriptionState;
  membersMax: number;
  aiEntriesMonth: number;
  /** null = unlimited history. */
  historyMonths: number | null;
  features: Record<FeatureKey, boolean>;
  periodEnd: string | null;
}

/** The family's current subscription, if any. `billing.subscriptions` arrives in T-BILL-05; until then none. */
export interface SubscriptionSnapshot {
  planId: PlanId;
  state: SubscriptionState;
  periodEnd: string | null;
}
export type SubscriptionSource = (familyId: string) => Promise<SubscriptionSnapshot | null>;

export const CACHE_TTL_MS = 60_000;
const UNLIMITED = Number.MAX_SAFE_INTEGER;

export interface EntitlementsDeps {
  db: Db;
  clock?: () => Date;
  subscriptionOf?: SubscriptionSource;
}

export interface OverrideInput {
  aiEntriesMonth?: number | null;
  membersMax?: number | null;
  reason: string;
  setBy: string;
}

export function createEntitlements(deps: EntitlementsDeps) {
  const clock = deps.clock ?? (() => new Date());
  const subscriptionOf: SubscriptionSource = deps.subscriptionOf ?? (async () => null);
  const cache = new Map<string, { at: number; value: Entitlements }>();

  async function planLimits(planId: PlanId): Promise<PlanLimits> {
    const rows = await listPlanLimits(deps.db);
    return toLimits(rows.filter((r) => r.planId === planId));
  }

  async function compute(familyId: string): Promise<Entitlements> {
    const sub = await subscriptionOf(familyId);
    const expired = sub?.state === "expired";
    const planId: PlanId = sub && !expired ? sub.planId : "free";
    const limits = await planLimits(planId);
    const o = await getOverride(deps.db, familyId);
    return {
      planId,
      state: sub?.state ?? "none",
      membersMax: o?.membersMax ?? limits.membersMax ?? UNLIMITED,
      aiEntriesMonth: o?.aiEntriesMonth ?? limits.aiEntriesMonth ?? UNLIMITED,
      historyMonths: limits.historyMonths,
      features: {
        receiptVision: limits.receiptVision,
        ask: limits.ask,
        exportBeyondCsv: limits.exportBeyondCsv,
        multiCurrency: limits.multiCurrency,
        remittancePlanner: limits.remittancePlanner,
      },
      periodEnd: expired ? null : (sub?.periodEnd ?? null),
    };
  }

  async function entitlements(familyId: string): Promise<Entitlements> {
    const now = clock().getTime();
    const hit = cache.get(familyId);
    if (hit && now - hit.at < CACHE_TTL_MS) return hit.value;
    const value = await compute(familyId);
    cache.set(familyId, { at: now, value });
    return value;
  }

  return {
    entitlements,
    invalidate(familyId: string): void {
      cache.delete(familyId);
    },
    async setOverride(familyId: string, input: OverrideInput): Promise<void> {
      await upsertOverride(
        deps.db,
        {
          familyId,
          aiEntriesMonth: input.aiEntriesMonth ?? null,
          membersMax: input.membersMax ?? null,
          reason: input.reason,
          setBy: input.setBy,
        },
        clock(),
      );
      cache.delete(familyId);
    },
    async assertFeature(familyId: string, feature: FeatureKey): Promise<void> {
      const e = await entitlements(familyId);
      if (!e.features[feature]) {
        throw new HttpError(402, "plan_required", "This feature needs a higher plan", { feature });
      }
    },
    /** `currentCount` is the member count before the add; throws when one more would exceed the limit. */
    async assertMemberCapacity(familyId: string, currentCount: number): Promise<void> {
      const e = await entitlements(familyId);
      if (currentCount >= e.membersMax) {
        throw new HttpError(409, "plan_member_limit", "The family has reached its member limit", {
          membersMax: e.membersMax,
        });
      }
    },
  };
}

export type EntitlementsService = ReturnType<typeof createEntitlements>;
