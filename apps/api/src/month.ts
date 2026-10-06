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
