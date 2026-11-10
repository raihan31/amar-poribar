export interface RecurringLike {
  dayOfMonth: number;
  startsOn: string;
  endsOn: string | null;
  active: boolean;
  lastConfirmedMonth: string | null;
  remindDaysBefore: number;
}

/** Due date (YYYY-MM-DD) inside `month`; a day past the month's end uses the last day. */
export function dueDateIn(month: string, dayOfMonth: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(dayOfMonth, last)).padStart(2, "0")}`;
}

/** Whether the template has an unconfirmed draft for `month`. */
export function isDueIn(t: RecurringLike, month: string): boolean {
  if (!t.active) return false;
  const due = dueDateIn(month, t.dayOfMonth);
  if (due < t.startsOn) return false;
  if (t.endsOn && due > t.endsOn) return false;
  return t.lastConfirmedMonth !== month;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Bill reminder: unconfirmed, and today is within `remindDaysBefore` of the due date (or past it) (FR-NOT-03). */
export function reminderState(t: RecurringLike, today: string): { due: string; daysUntil: number } | null {
  const month = today.slice(0, 7);
  if (!isDueIn(t, month)) return null;
  const due = dueDateIn(month, t.dayOfMonth);
  const daysUntil = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return today >= addDays(due, -t.remindDaysBefore) ? { due, daysUntil } : null;
}
