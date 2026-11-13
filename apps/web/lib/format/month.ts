export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Percent change vs last month, or null when there is nothing to compare against. */
export function delta(now: number, before: number): { pct: number; dir: "up" | "down" | "flat" } | null {
  if (before <= 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return { pct: Math.abs(pct), dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

/** "YYYY-MM" as a long month and year, e.g. "জানুয়ারি ২০২৬" for bn-BD. */
export function monthLabel(month: string, locale: string): string {
  return new Date(`${month}-01T00:00:00+06:00`).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

/** The current "YYYY-MM" in Asia/Dhaka. */
export function currentMonth(now: number = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit" })
    .formatToParts(new Date(now))
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.year}-${parts.month}`;
}

/** "YYYY-MM-DD" of an instant in Asia/Dhaka. */
export function dhakaDay(now: number = Date.now()): string {
  return new Date(now + 6 * 3_600_000).toISOString().slice(0, 10);
}
