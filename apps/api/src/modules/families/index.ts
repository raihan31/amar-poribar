import type { ModuleDefinition } from "../../platform/module.js";
export * from "./events.js";

/** Public surface of the families module. Other modules may import only this file (SRS R1). */
export interface FamiliesFacade {
  readonly name: "families";
}

declare module "../../platform/module.js" {
  interface Facades {
    families: FamiliesFacade;
  }
}

export const familiesModule: ModuleDefinition<FamiliesFacade> = {
  name: "families",
  dependsOn: ["identity"],
  register() {
    return { name: "families" };
  },
};
