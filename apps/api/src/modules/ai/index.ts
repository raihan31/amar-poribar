import type { ModuleDefinition } from "../../platform/module.js";
export * from "./events.js";

/** Public surface of the ai module. Other modules may import only this file (SRS R1). */
export interface AiFacade {
  readonly name: "ai";
}

declare module "../../platform/module.js" {
  interface Facades {
    ai: AiFacade;
  }
}

export const aiModule: ModuleDefinition<AiFacade> = {
  name: "ai",
  dependsOn: ["families", "ledger", "billing"],
  register() {
    return { name: "ai" };
  },
};
