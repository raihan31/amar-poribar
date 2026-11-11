import type { ModuleDefinition } from "../../platform/module.js";
import { getPlanCatalogue, type PlanLimits, type PlanView } from "./app/catalogue.js";
import { planRoutes } from "./http/plan-routes.js";
export * from "./events.js";
export type { PlanLimits, PlanView };

/** Public surface of the billing module. Other modules may import only this file (SRS R1). */
export interface BillingFacade {
  readonly name: "billing";
  getPlanCatalogue(): Promise<PlanView[]>;
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
    planRoutes(app, { db: ctx.db });
    return { name: "billing", getPlanCatalogue: () => getPlanCatalogue(ctx.db) };
  },
};
