import { asc, eq } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import { planLimits, plans } from "../schema.js";

export type PlanRow = typeof plans.$inferSelect;
export type PlanLimitRow = typeof planLimits.$inferSelect;

/** Active plans in display order. */
export function listActivePlans(db: Db): Promise<PlanRow[]> {
  return db.select().from(plans).where(eq(plans.active, true)).orderBy(asc(plans.sort));
}

export function listPlanLimits(db: Db): Promise<PlanLimitRow[]> {
  return db.select().from(planLimits);
}
