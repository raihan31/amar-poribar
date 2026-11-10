import type { ModuleDefinition } from "../../platform/module.js";
import type { RecurringDeps } from "./app/deps.js";
import { listDueReminders, type DueReminder } from "./app/reminders.js";
import { recurringRoutes } from "./http/recurring.routes.js";
export * from "./events.js";

export type { DueReminder };

/** Public surface of the recurring module. Other modules may import only this file (SRS R1). */
export interface RecurringFacade {
  readonly name: "recurring";
  /** Unconfirmed bills whose reminder window has started (or that are overdue), across all families. */
  listDueReminders(today: string): Promise<DueReminder[]>;
}

declare module "../../platform/module.js" {
  interface Facades {
    recurring: RecurringFacade;
  }
}

export const recurringModule: ModuleDefinition<RecurringFacade> = {
  name: "recurring",
  dependsOn: ["families", "ledger"],
  register(app, ctx) {
    const { families, ledger } = ctx.facades;
    if (!families || !ledger) throw new Error("recurring: families and ledger must be registered first");
    const deps: RecurringDeps = { db: ctx.db, families, ledger };
    recurringRoutes(app, deps);
    return { name: "recurring", listDueReminders: (today) => listDueReminders(deps, today) };
  },
};
