/** Inbox kinds (FR-NOTIF-04). Request/response schemas are added in T-NOTIF-03 and T-NOTIF-06. */
export const INBOX_KINDS = [
  "budget_threshold",
  "invite",
  "daily_reminder",
  "bill_due",
  "nudge",
  "message",
  "call_missed",
  "call_incoming",
  "dhar_due",
  "export_ready",
  "erasure_scheduled",
  "plan_changed",
  "system",
] as const;

export type InboxKind = (typeof INBOX_KINDS)[number];
