import type { CreateRecurringInput, UpdateRecurringInput } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { templatesRepo, type Template } from "../infra/templates.repo.js";
import type { RecurringDeps } from "./deps.js";

export function listTemplates(deps: RecurringDeps, familyId: string): Promise<Template[]> {
  return templatesRepo.listByFamily(deps.db, familyId);
}

export async function createTemplate(
  deps: RecurringDeps,
  familyId: string,
  userId: string,
  input: CreateRecurringInput,
): Promise<Template> {
  await deps.ledger.assertOwnedRefs(familyId, input);
  return templatesRepo.insert(deps.db, { ...input, endsOn: input.endsOn ?? null, familyId, createdBy: userId });
}

export async function updateTemplate(
  deps: RecurringDeps,
  familyId: string,
  id: string,
  input: UpdateRecurringInput,
): Promise<Template> {
  await deps.ledger.assertOwnedRefs(familyId, input);
  const row = await templatesRepo.update(deps.db, familyId, id, input);
  if (!row) throw new HttpError(404, "not_found", "Recurring entry not found");
  return row;
}
