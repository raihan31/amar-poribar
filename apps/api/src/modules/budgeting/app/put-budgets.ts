import type { PutBudgetsInput } from "@amar-poribar/shared";
import { budgetsRepo } from "../infra/budgets.repo.js";
import type { BudgetingDeps } from "./deps.js";

export async function putBudgets(
  deps: BudgetingDeps,
  familyId: string,
  month: string,
  input: PutBudgetsInput,
): Promise<{ month: string; updated: number }> {
  const ids = [...new Set(input.budgets.flatMap((b) => (b.categoryId ? [b.categoryId] : [])))];
  for (const categoryId of ids) await deps.ledger.assertRefs(familyId, { categoryId });
  await budgetsRepo.upsertMonth(deps.db, familyId, month, input.budgets);
  return { month, updated: input.budgets.length };
}
