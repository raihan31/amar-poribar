import type { ModuleDefinition } from "../../platform/module.js";
export * from "./events.js";

/** Public surface of the notifications module. Other modules may import only this file (SRS R1). */
export interface NotificationsFacade {
  readonly name: "notifications";
}

declare module "../../platform/module.js" {
  interface Facades {
    notifications: NotificationsFacade;
  }
}

export const notificationsModule: ModuleDefinition<NotificationsFacade> = {
  name: "notifications",
  dependsOn: ["identity", "families"],
  register() {
    return { name: "notifications" };
  },
};
