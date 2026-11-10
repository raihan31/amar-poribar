import { reminderState } from "../domain/schedule.js";
import { templatesRepo } from "../infra/templates.repo.js";
import type { RecurringDeps } from "./deps.js";

export interface Reminder {
  id: string;
  name: string;
  amountPaisa: number;
  dueOn: string;
  daysUntil: number;
}

/** Upcoming and overdue bills of one family (FR-NOT-03). Delivery by push is separate. */
export async function listReminders(deps: RecurringDeps, familyId: string, today: string): Promise<Reminder[]> {
  const rows = await templatesRepo.listByFamily(deps.db, familyId);
  return rows.flatMap((t) => {
    const r = reminderState(t, today);
    return r ? [{ id: t.id, name: t.name, amountPaisa: t.amountPaisa, dueOn: r.due, daysUntil: r.daysUntil }] : [];
  });
}

export interface DueReminder extends Reminder {
  familyId: string;
}

/** Due reminders across all families, for the notifications job. */
export async function listDueReminders(deps: Pick<RecurringDeps, "db">, today: string): Promise<DueReminder[]> {
  const rows = await templatesRepo.listActive(deps.db);
  return rows.flatMap((t) => {
    const r = reminderState(t, today);
    if (!r) return [];
    const { familyId, id, name, amountPaisa } = t;
    return [{ familyId, id, name, amountPaisa, dueOn: r.due, daysUntil: r.daysUntil }];
  });
}
