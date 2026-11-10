import { dueDateIn, isDueIn } from "../domain/schedule.js";
import { templatesRepo, type Template } from "../infra/templates.repo.js";
import type { RecurringDeps } from "./deps.js";

/** Drafts for a month: templates due and not yet confirmed (FR-TXN-06). The user confirms each one. */
export async function listDrafts(
  deps: RecurringDeps,
  familyId: string,
  month: string,
): Promise<{ month: string; drafts: (Template & { dueOn: string })[] }> {
  const rows = await templatesRepo.listByFamily(deps.db, familyId);
  return {
    month,
    drafts: rows.filter((t) => isDueIn(t, month)).map((t) => ({ ...t, dueOn: dueDateIn(month, t.dayOfMonth) })),
  };
}
