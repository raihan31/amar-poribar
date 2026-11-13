import type { ModuleDefinition } from "../../platform/module.js";
import { syncRoutes } from "./http/sync.routes.js";
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
  register(app, ctx) {
    const { families, ledger } = ctx.facades;
    if (!families || !ledger) throw new Error("sync: families and ledger must be registered first");
    syncRoutes(app, { families, ledger });
    return { name: "sync" };
  },
};
