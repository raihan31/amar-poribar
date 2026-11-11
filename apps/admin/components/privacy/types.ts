export type StepState = "done" | "waiting" | "todo";

export interface PrivacyStep {
  key: string;
  label: string;
  state: StepState;
  /** True when the system performs this step by itself. */
  auto?: boolean;
  nextRunAt?: string;
}

export interface PrivacyRequest {
  id: string;
  kind: "delete" | "export";
  personPhoneMasked: string;
  familyName: string;
  receivedAt: string;
  dueAt: string;
  step: string;
  steps: PrivacyStep[];
}

export interface PrivacyList {
  items: PrivacyRequest[];
  counts: { open: number; done: number; rejected: number };
  nextCursor?: string | null;
}

export type PrivacyStatus = "open" | "done" | "rejected";

const DAY = 86_400_000;

/** Whole days left, rounded up; zero or negative when overdue. */
export function daysLeft(dueAt: string, now: Date = new Date()): number {
  return Math.ceil((new Date(dueAt).getTime() - now.getTime()) / DAY);
}

export function isOverdue(dueAt: string, now: Date = new Date()): boolean {
  return new Date(dueAt).getTime() < now.getTime();
}

export function overdueDays(dueAt: string, now: Date = new Date()): number {
  return Math.max(1, Math.floor((now.getTime() - new Date(dueAt).getTime()) / DAY));
}
