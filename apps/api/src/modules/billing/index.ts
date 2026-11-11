import type { ModuleDefinition } from "../../platform/module.js";
import { getPlanCatalogue, type PlanLimits, type PlanView } from "./app/catalogue.js";
import { createEntitlements, type Entitlements, type FeatureKey, type OverrideInput } from "./app/entitlements.js";
import { entitlementsRoutes } from "./http/entitlements-routes.js";
import { planRoutes } from "./http/plan-routes.js";
export * from "./events.js";
export type { PlanLimits, PlanView, Entitlements, FeatureKey, OverrideInput };

/** Public surface of the billing module. Other modules may import only this file (SRS R1). */
export interface BillingFacade {
  readonly name: "billing";
  getPlanCatalogue(): Promise<PlanView[]>;
  /** Effective plan limits for a family, cached 60 s (FR-BILL-05). */
  entitlements(familyId: string): Promise<Entitlements>;
  /** Throws `HttpError(402, "plan_required", ..., {feature})`. */
  assertFeature(familyId: string, feature: FeatureKey): Promise<void>;
  /** `currentCount` is the count before the add; throws `HttpError(409, "plan_member_limit")` when full. */
  assertMemberCapacity(familyId: string, currentCount: number): Promise<void>;
  /** Staff quota override; busts the cache. */
  setOverride(familyId: string, input: OverrideInput): Promise<void>;
}

declare module "../../platform/module.js" {
  interface Facades {
    billing: BillingFacade;
  }
}

export const billingModule: ModuleDefinition<BillingFacade> = {
  name: "billing",
  dependsOn: ["families"],
  register(app, ctx) {
    const families = ctx.facades.families;
    if (!families) throw new Error("billing: families must be registered first");
    const service = createEntitlements({ db: ctx.db, clock: ctx.clock });
    ctx.bus.on("billing.SubscriptionChanged.v1", "billing.bust-entitlements", (e) => {
      service.invalidate(e.payload.familyId);
    });
    planRoutes(app, { db: ctx.db });
    entitlementsRoutes(app, { service, requireRole: (f, u, r) => families.requireRole(f, u, r) });
    return {
      name: "billing",
      getPlanCatalogue: () => getPlanCatalogue(ctx.db),
      entitlements: (familyId) => service.entitlements(familyId),
      assertFeature: (familyId, feature) => service.assertFeature(familyId, feature),
      assertMemberCapacity: (familyId, count) => service.assertMemberCapacity(familyId, count),
      setOverride: (familyId, input) => service.setOverride(familyId, input),
    };
  },
};
