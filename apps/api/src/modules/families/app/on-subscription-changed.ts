import type { Db } from "../../../platform/db.js";
import { familiesRepo } from "../infra/families.repo.js";

export interface SubscriptionChangedInput {
  familyId: string;
  planKey: string;
  memberLimit: number;
  aiQuotaMonth: number;
}

/**
 * Billing owns plans; families keeps a local copy of the limits it enforces (FR-FAM-10).
 * Idempotent: applying the same event twice leaves the same row. A missing family is ignored.
 */
export async function onSubscriptionChanged(deps: { db: Db; clock: () => Date }, p: SubscriptionChangedInput) {
  await familiesRepo.applyPlan(
    deps.db,
    p.familyId,
    { plan: p.planKey, memberLimit: p.memberLimit, aiQuotaMonth: p.aiQuotaMonth },
    deps.clock(),
  );
}
