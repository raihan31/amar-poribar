import type { ModuleDefinition } from "../../platform/module.js";
export * from "./events.js";

/** Public surface of the budgeting module. Other modules may import only this file (SRS R1). */
export interface BudgetingFacade {
  readonly name: "budgeting";
}

declare module "../../platform/module.js" {
  interface Facades {
    budgeting: BudgetingFacade;
  }
}

export const budgetingModule: ModuleDefinition<BudgetingFacade> = {
  name: "budgeting",
  dependsOn: ["families", "ledger"],
  register() {
    return { name: "budgeting" };
  },
};
