import type { MonthSummary } from "@amar-poribar/shared";
import type { ModuleDefinition } from "../../platform/module.js";
import type { ReportingDeps } from "./app/deps.js";
import { monthSummary } from "./app/month-summary.js";
import { reportsRoutes } from "./http/report-routes.js";
export * from "./events.js";

/** Public surface of the reporting module. Other modules may import only this file (SRS R1). */
export interface ReportingFacade {
  readonly name: "reporting";
  /** Month totals against the previous month, as visible to `userId` (FR-TXN-05). */
  monthSummary(familyId: string, userId: string, month: string): Promise<MonthSummary>;
}

declare module "../../platform/module.js" {
  interface Facades {
    reporting: ReportingFacade;
  }
}

export const reportingModule: ModuleDefinition<ReportingFacade> = {
  name: "reporting",
  dependsOn: ["families", "ledger"],
  register(app, ctx) {
    const { families, ledger } = ctx.facades;
    if (!families || !ledger) throw new Error("reporting: families and ledger must be registered first");
    const deps: ReportingDeps = { families, ledger };
    reportsRoutes(app, deps);
    return {
      name: "reporting",
      monthSummary: (familyId, userId, month) => monthSummary(deps, familyId, userId, month),
    };
  },
};
