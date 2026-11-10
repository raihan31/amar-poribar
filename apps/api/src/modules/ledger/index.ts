import type { ModuleDefinition } from "../../platform/module.js";
export * from "./events.js";

/** Public surface of the ledger module. Other modules may import only this file (SRS R1). */
export interface LedgerFacade {
  readonly name: "ledger";
}

declare module "../../platform/module.js" {
  interface Facades {
    ledger: LedgerFacade;
  }
}

export const ledgerModule: ModuleDefinition<LedgerFacade> = {
  name: "ledger",
  dependsOn: ["families"],
  register() {
    return { name: "ledger" };
  },
};
