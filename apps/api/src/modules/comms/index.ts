import type { ModuleDefinition } from "../../platform/module.js";
export * from "./events.js";

/** Public surface of the comms module. Other modules may import only this file (SRS R1). */
export interface CommsFacade {
  readonly name: "comms";
}

declare module "../../platform/module.js" {
  interface Facades {
    comms: CommsFacade;
  }
}

export const commsModule: ModuleDefinition<CommsFacade> = {
  name: "comms",
  dependsOn: ["families", "identity", "notifications"],
  register() {
    return { name: "comms" };
  },
};
