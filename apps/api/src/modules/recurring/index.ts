import type { ModuleDefinition } from "../../platform/module.js";
export * from "./events.js";

/** Public surface of the recurring module. Other modules may import only this file (SRS R1). */
export interface RecurringFacade {
  readonly name: "recurring";
}

declare module "../../platform/module.js" {
  interface Facades {
    recurring: RecurringFacade;
  }
}

export const recurringModule: ModuleDefinition<RecurringFacade> = {
  name: "recurring",
  dependsOn: ["families", "ledger"],
  register() {
    return { name: "recurring" };
  },
};
