import type { ParseResponse, TransactionDraft } from "@amar-poribar/shared";
import type { Category } from "@/lib/types";

/** What the read-back and picker screens render for one parsed draft. */
export interface DraftView {
  draft: TransactionDraft;
  /** Resolved from `draft.categoryKey`; null when the server could not tell (AC-09). */
  category: Category | null;
  needsCategory: boolean;
}

export function toDraftView(draft: TransactionDraft, categories: Category[]): DraftView {
  const category = draft.categoryKey ? (categories.find((c) => c.key === draft.categoryKey) ?? null) : null;
  return { draft, category, needsCategory: category === null };
}

/** Maps the server response to view models; `voice` marks every draft `source:"voice"` (FR-VOICE-01). */
export function toDraftViews(res: ParseResponse, categories: Category[], voice: boolean): DraftView[] {
  return res.drafts.map((d) => toDraftView(voice ? { ...d, source: "voice" } : d, categories));
}

const dhakaDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);

/** "today" / "yesterday" in Dhaka time, otherwise null (the caller prints the date). */
export function dayWord(occurredAt: string, now: Date = new Date()): "today" | "yesterday" | null {
  const day = dhakaDay(new Date(occurredAt));
  if (day === dhakaDay(now)) return "today";
  if (day === dhakaDay(new Date(now.getTime() - 86_400_000))) return "yesterday";
  return null;
}

/** Bangla "in/at" form for the save button: "বাজার" becomes "বাজারে", "শিক্ষা" becomes "শিক্ষাতে". */
export function bnLocative(name: string): string {
  const last = [...name.trim()].pop() ?? "";
  return /[া-ৌৗঅ-ঔ]/.test(last) ? `${name}তে` : `${name}ে`;
}
