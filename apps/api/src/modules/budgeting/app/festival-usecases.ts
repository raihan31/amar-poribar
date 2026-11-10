import type { CreateFestivalBudgetInput, UpdateFestivalBudgetInput } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { dayRange } from "../../../platform/time/month.js";
import { budgetLevel, type BudgetLevel } from "../domain/budget-level.js";
import { budgetsRepo, type FestivalBudget } from "../infra/budgets.repo.js";
import type { BudgetingDeps } from "./deps.js";

export type FestivalBudgetWithSpend = FestivalBudget & { spentPaisa: number; level: BudgetLevel };

/** Festival budgets (Eid, Puja): a spending limit over a date range (FR-BUD-04). */
export async function listFestivalBudgets(
  deps: BudgetingDeps,
  familyId: string,
  userId: string,
): Promise<FestivalBudgetWithSpend[]> {
  const rows = await budgetsRepo.listFestivals(deps.db, familyId);
  return Promise.all(
    rows
      .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
      .map(async (f) => {
        const { start, end } = dayRange(f.startsOn, f.endsOn);
        const spentPaisa = await deps.ledger.expenseTotalBetween(familyId, userId, start, end);
        return { ...f, spentPaisa, level: budgetLevel(spentPaisa, f.limitPaisa) };
      }),
  );
}

export function createFestivalBudget(
  deps: BudgetingDeps,
  familyId: string,
  body: CreateFestivalBudgetInput,
): Promise<FestivalBudget> {
  return budgetsRepo.insertFestival(deps.db, { ...body, familyId });
}

export async function updateFestivalBudget(
  deps: BudgetingDeps,
  familyId: string,
  festivalId: string,
  body: UpdateFestivalBudgetInput,
): Promise<FestivalBudget> {
  const current = await budgetsRepo.getFestival(deps.db, familyId, festivalId);
  if (!current) throw new HttpError(404, "not_found", "Festival budget not found");
  // The range must still be valid after a partial update.
  const startsOn = body.startsOn ?? current.startsOn;
  const endsOn = body.endsOn ?? current.endsOn;
  if (endsOn < startsOn) throw new HttpError(400, "invalid_request", "endsOn must not be before startsOn");
  const row = await budgetsRepo.updateFestival(deps.db, familyId, festivalId, body);
  if (!row) throw new HttpError(404, "not_found", "Festival budget not found");
  return row;
}

export async function deleteFestivalBudget(deps: BudgetingDeps, familyId: string, festivalId: string): Promise<void> {
  if (!(await budgetsRepo.deleteFestival(deps.db, familyId, festivalId))) {
    throw new HttpError(404, "not_found", "Festival budget not found");
  }
}
