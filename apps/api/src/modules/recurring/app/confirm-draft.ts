import { HttpError } from "../../../platform/errors.js";
import type { Transaction } from "../../ledger/index.js";
import { dueDateIn, isDueIn } from "../domain/schedule.js";
import { templatesRepo } from "../infra/templates.repo.js";
import type { RecurringDeps } from "./deps.js";

/**
 * Records the draft for a month as one transaction (a second call is rejected with 409).
 * Order is ledger first, then `lastConfirmedMonth` (not atomic across modules). The template row stays locked
 * for the whole call so two confirmations cannot both pass the check, and the update is idempotent.
 */
export async function confirmDraft(
  deps: RecurringDeps,
  input: { familyId: string; templateId: string; userId: string; month: string },
): Promise<Transaction> {
  const { familyId, templateId, userId, month } = input;
  return deps.db.transaction(async (tx) => {
    const t = await templatesRepo.getForUpdate(tx, familyId, templateId);
    if (!t) throw new HttpError(404, "not_found", "Recurring entry not found");
    if (!isDueIn(t, month)) throw new HttpError(409, "not_due", "Nothing to confirm for this month");
    const row = await deps.ledger.createTransaction(
      familyId,
      { userId },
      {
        type: t.type,
        amountPaisa: t.amountPaisa,
        feePaisa: 0,
        occurredAt: `${dueDateIn(month, t.dayOfMonth)}T12:00:00+06:00`,
        categoryId: t.categoryId,
        accountId: t.accountId,
        note: t.name,
        source: "manual",
        isPrivate: false,
      },
    );
    await templatesRepo.markConfirmed(tx, t.id, month);
    return row;
  });
}
