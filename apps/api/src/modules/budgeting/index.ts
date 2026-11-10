import type { ModuleDefinition } from "../../platform/module.js";
import type { BudgetingDeps } from "./app/deps.js";
import { listFestivalBudgets, type FestivalBudgetWithSpend } from "./app/festival-usecases.js";
import { getBudgetSummary, type BudgetSummary } from "./app/get-budgets.js";
import { budgetsRoutes } from "./http/budgets.routes.js";
import { festivalsRoutes } from "./http/festivals.routes.js";
export * from "./events.js";

export type { BudgetSummary, FestivalBudgetWithSpend };

/** Public surface of the budgeting module. Other modules may import only this file (SRS R1). */
export interface BudgetingFacade {
  readonly name: "budgeting";
  /** Effective budgets for `month` with spending as visible to `userId` (FR-BUD-01..03). */
  getBudgetSummary(familyId: string, userId: string, month: string): Promise<BudgetSummary>;
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
    budgetsRoutes(app, deps);
    festivalsRoutes(app, deps);
    return {
      name: "budgeting",
      getBudgetSummary: (familyId, userId, month) => getBudgetSummary(deps, familyId, userId, month),
      listFestivalBudgets: (familyId, userId) => listFestivalBudgets(deps, familyId, userId),
    };
  },
};
