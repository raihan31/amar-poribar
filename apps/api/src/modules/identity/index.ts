import type { ModuleDefinition } from "../../platform/module.js";
export * from "./events.js";

/** Public surface of the identity module. Other modules may import only this file (SRS R1). */
export interface IdentityFacade {
  readonly name: "identity";
}

declare module "../../platform/module.js" {
  interface Facades {
    identity: IdentityFacade;
  }
}

export const identityModule: ModuleDefinition<IdentityFacade> = {
  name: "identity",
  dependsOn: [],
  register() {
    return { name: "identity" };
  },
};
