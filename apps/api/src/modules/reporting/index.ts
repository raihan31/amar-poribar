import type { ModuleDefinition } from "../../platform/module.js";
export * from "./events.js";

/** Public surface of the reporting module. Other modules may import only this file (SRS R1). */
export interface ReportingFacade {
  readonly name: "reporting";
}

declare module "../../platform/module.js" {
  interface Facades {
    reporting: ReportingFacade;
  }
}

export const reportingModule: ModuleDefinition<ReportingFacade> = {
  name: "reporting",
  dependsOn: ["families", "ledger"],
  register() {
    return { name: "reporting" };
  },
};
