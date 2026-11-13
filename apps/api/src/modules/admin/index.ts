import type { ModuleDefinition } from "../../platform/module.js";
export * from "./events.js";

/** Public surface of the admin module. Other modules may import only this file (SRS R1). */
export interface AdminFacade {
  readonly name: "admin";
}

declare module "../../platform/module.js" {
  interface Facades {
    admin: AdminFacade;
  }
}

export const adminModule: ModuleDefinition<AdminFacade> = {
  name: "admin",
  dependsOn: ["families", "billing", "privacy"],
  register() {
    return { name: "admin" };
  },
};
