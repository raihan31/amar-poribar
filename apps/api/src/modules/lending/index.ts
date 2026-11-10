import type { ModuleDefinition } from "../../platform/module.js";
export * from "./events.js";

/** Public surface of the lending module. Other modules may import only this file (SRS R1). */
export interface LendingFacade {
  readonly name: "lending";
}

declare module "../../platform/module.js" {
  interface Facades {
    lending: LendingFacade;
  }
}

export const lendingModule: ModuleDefinition<LendingFacade> = {
  name: "lending",
  dependsOn: ["families"],
  register() {
    return { name: "lending" };
  },
};
