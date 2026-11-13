import { StatusPill } from "@/components/ui/StatusPill";
import { daysLeft, isOverdue, overdueDays } from "./types";

/** Neutral above 10 days, amber at 10 or fewer, red at 5 or fewer and when overdue. Text is always present. */
export function DeadlinePill({ dueAt, now }: { dueAt: string; now?: Date }) {
  if (isOverdue(dueAt, now)) {
    const d = overdueDays(dueAt, now);
    return <StatusPill kind="risk">{`Overdue by ${d} ${d === 1 ? "day" : "days"}`}</StatusPill>;
  }
  const n = daysLeft(dueAt, now);
  const text = `${n} ${n === 1 ? "day" : "days"} left`;
  if (n <= 5) return <StatusPill kind="risk">{text}</StatusPill>;
  if (n <= 10) return <StatusPill kind="warn">{text}</StatusPill>;
  return <StatusPill kind="neutral">{text}</StatusPill>;
}
