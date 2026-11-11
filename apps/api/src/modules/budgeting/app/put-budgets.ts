import type { PutBudgetsInput } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { budgetsRepo } from "../infra/budgets.repo.js";
import type { BudgetingDeps } from "./deps.js";

export async function putBudgets(
  deps: BudgetingDeps,
  familyId: string,
  month: string,
  input: PutBudgetsInput,
): Promise<{ month: string; updated: number }> {
  const ids = [...new Set(input.budgets.flatMap((b) => (b.categoryId ? [b.categoryId] : [])))];
  if (ids.length) {
    const owned = new Set((await deps.ledger.listCategories(familyId, { includeHidden: true })).map((c) => c.id));
    if (!ids.every((id) => owned.has(id))) throw new HttpError(400, "invalid_category", "Unknown category");
  }
  await budgetsRepo.upsertMonth(deps.db, familyId, month, input.budgets);
  return { month, updated: input.budgets.length };
}
