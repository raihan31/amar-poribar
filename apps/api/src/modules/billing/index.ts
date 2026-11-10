import type { ModuleDefinition } from "../../platform/module.js";
export * from "./events.js";

/** Public surface of the billing module. Other modules may import only this file (SRS R1). */
export interface BillingFacade {
  readonly name: "billing";
}

declare module "../../platform/module.js" {
  interface Facades {
    billing: BillingFacade;
  }
}

export const billingModule: ModuleDefinition<BillingFacade> = {
  name: "billing",
  dependsOn: ["families"],
  register() {
    return { name: "billing" };
  },
};
