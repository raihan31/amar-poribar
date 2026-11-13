import type { ModuleDefinition } from "../../platform/module.js";
import type { Viewer } from "../ledger/index.js";
import type { AlertDeps, BudgetingDeps } from "./app/deps.js";
import { onTransactionChanged } from "./app/on-transaction-changed.js";
import { purgeAlertsJob } from "./jobs.js";
import { listFestivalBudgets, type FestivalBudgetWithSpend } from "./app/festival-usecases.js";
import { getBudgetStatus, getEffectiveBudgets, type BudgetSummary, type EffectiveBudget } from "./app/get-budgets.js";
import { budgetsRoutes } from "./http/budget-routes.js";
import { festivalsRoutes } from "./http/festivals.routes.js";
export * from "./events.js";

export type { BudgetSummary, EffectiveBudget, FestivalBudgetWithSpend };

/** Public surface of the budgeting module. Other modules may import only this file (SRS R1). */
export interface BudgetingFacade {
  readonly name: "budgeting";
  /** Effective budgets for `month` with spending as visible to `viewer`, plus status words (FR-BUD-01..03, -07). */
  getBudgetStatus(familyId: string, viewer: Viewer, month: string): Promise<BudgetSummary>;
  /** Budgets in force for `month` (inherited from earlier months when unset), for alerts and sync (FR-BUD-03). */
  getEffectiveBudgets(familyId: string, month: string): Promise<EffectiveBudget[]>;
  /** Festival budgets with spending over their date range (FR-BUD-04). */
  listFestivalBudgets(familyId: string, userId: string): Promise<FestivalBudgetWithSpend[]>;
}

declare module "../../platform/module.js" {
  interface Facades {
    budgeting: BudgetingFacade;
  }
}

export const budgetingModule: ModuleDefinition<BudgetingFacade> = {
  name: "budgeting",
  dependsOn: ["families", "ledger"],
  register(app, ctx) {
    const { families, ledger } = ctx.facades;
    if (!families || !ledger) throw new Error("budgeting: families and ledger must be registered first");
    const deps: BudgetingDeps = { db: ctx.db, families, ledger };
    const alertDeps: AlertDeps = { ...deps, bus: ctx.bus, clock: ctx.clock };
    for (const name of [
      "ledger.TransactionCreated.v1",
      "ledger.TransactionUpdated.v1",
      "ledger.TransactionDeleted.v1",
    ] as const) {
      ctx.bus.on(name, "budgeting.evaluate", (event) => onTransactionChanged(alertDeps, event.payload));
    }
    ctx.jobs.register(purgeAlertsJob({ db: ctx.db, clock: ctx.clock, logger: ctx.logger }));
    budgetsRoutes(app, deps);
    festivalsRoutes(app, deps);
    return {
      name: "budgeting",
      getBudgetStatus: (familyId, viewer, month) => getBudgetStatus(deps, familyId, viewer, month),
      getEffectiveBudgets: (familyId, month) => getEffectiveBudgets(deps, familyId, month),
      listFestivalBudgets: (familyId, userId) => listFestivalBudgets(deps, familyId, userId),
    };
  },
};
