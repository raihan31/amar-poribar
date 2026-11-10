import type { ModuleDefinition } from "../../platform/module.js";
export * from "./events.js";

/** Public surface of the sync module. Other modules may import only this file (SRS R1). */
export interface SyncFacade {
  readonly name: "sync";
}

declare module "../../platform/module.js" {
  interface Facades {
    sync: SyncFacade;
  }
}

export const syncModule: ModuleDefinition<SyncFacade> = {
  name: "sync",
  dependsOn: ["families", "ledger"],
  register() {
    return { name: "sync" };
  },
};
