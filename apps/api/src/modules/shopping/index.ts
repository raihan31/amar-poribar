import type { ModuleDefinition } from "../../platform/module.js";
export * from "./events.js";

/** Public surface of the shopping module. Other modules may import only this file (SRS R1). */
export interface ShoppingFacade {
  readonly name: "shopping";
}

declare module "../../platform/module.js" {
  interface Facades {
    shopping: ShoppingFacade;
  }
}

export const shoppingModule: ModuleDefinition<ShoppingFacade> = {
  name: "shopping",
  dependsOn: ["families", "ledger"],
  register() {
    return { name: "shopping" };
  },
};
