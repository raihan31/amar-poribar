/** Start (inclusive) and end (exclusive) of a YYYY-MM month in Asia/Dhaka (UTC+6, no DST). */
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const start = new Date(`${month}-01T00:00:00+06:00`);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = new Date(`${nextY}-${String(nextM).padStart(2, "0")}-01T00:00:00+06:00`);
  return { start, end };
}

export function currentDhakaMonth(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit" }).format(now);
}

/** "2026-01" → "2025-12". */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** [start, end) covering whole Asia/Dhaka days from `from` to `to` inclusive (YYYY-MM-DD). */
export function dayRange(from: string, to: string): { start: Date; end: Date } {
  const start = new Date(`${from}T00:00:00+06:00`);
  const end = new Date(new Date(`${to}T00:00:00+06:00`).getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Every YYYY-MM from `from` to `to` inclusive, oldest first. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let m = from;
  while (m <= to && out.length < 120) {
    out.push(m);
    const [y, mo] = m.split("-").map(Number) as [number, number];
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  return out;
}
