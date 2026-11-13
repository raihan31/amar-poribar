import type { ModuleDefinition } from "../../platform/module.js";
export * from "./events.js";

/** Public surface of the privacy module. Other modules may import only this file (SRS R1). */
export interface PrivacyFacade {
  readonly name: "privacy";
}

declare module "../../platform/module.js" {
  interface Facades {
    privacy: PrivacyFacade;
  }
}

export const privacyModule: ModuleDefinition<PrivacyFacade> = {
  name: "privacy",
  dependsOn: ["identity", "families", "ledger", "comms"],
  register() {
    return { name: "privacy" };
  },
};
