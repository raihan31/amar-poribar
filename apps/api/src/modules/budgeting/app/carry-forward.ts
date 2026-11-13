import type { FastifyBaseLogger } from "fastify";
import type { Db } from "../../../platform/db.js";
import type { EventBus } from "../../../platform/events/bus.js";
import { previousMonth } from "../../../platform/time/month.js";
import { effectiveBudgets } from "../domain/effective.js";
import { budgetsRepo } from "../infra/budgets.repo.js";

export const CARRY_PAGE_SIZE = 200;

export interface CarryForwardDeps {
  db: Db;
  bus: EventBus;
  logger: FastifyBaseLogger;
}

/** Stores last month's effective budgets as `carried` rows for one family; publishes once when any were added. */
export async function carryForwardFamily(deps: CarryForwardDeps, familyId: string, month: string): Promise<number> {
  const rows = await budgetsRepo.listUpTo(deps.db, familyId, month);
  const inherited = effectiveBudgets(rows, month).filter((b) => b.inherited);
  if (inherited.length === 0) return 0;
  return deps.db.transaction(async (tx) => {
    const count = await budgetsRepo.insertCarried(tx, familyId, month, inherited);
    if (count > 0) {
      await deps.bus.publish(tx, "budgeting.BudgetsCarriedForward.v1", { familyId, month, count }, { familyId });
    }
    return count;
  });
}

/**
 * Carries one page of families (FR-BUD-03). Returns the cursor for the next page, or null when done.
 * Idempotent: existing rows for `month` are never changed.
 */
export async function carryForwardPage(
  deps: CarryForwardDeps,
  month: string,
  after: string | null,
): Promise<string | null> {
  const ids = await budgetsRepo.familiesWithBudgetsIn(deps.db, previousMonth(month), after, CARRY_PAGE_SIZE);
  let carried = 0;
  for (const familyId of ids) carried += await carryForwardFamily(deps, familyId, month);
  deps.logger.info({ month, families: ids.length, carried }, "budgeting.carry-forward");
  return ids.length === CARRY_PAGE_SIZE ? ids[ids.length - 1]! : null;
}
