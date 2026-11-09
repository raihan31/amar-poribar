const FORMULA_START = /^[=+\-@\t\r]/;

/** One CSV cell: quoted when needed, and neutralised against spreadsheet formula injection. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // User-entered text such as "=HYPERLINK(...)" must not run when opened in Excel/Sheets.
  if (typeof value === "string" && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

/** Paisa as a plain taka amount with two decimals, using integer maths (no float rounding). */
export function paisaToDecimal(paisa: number): string {
  const sign = paisa < 0 ? "-" : "";
  const abs = Math.abs(paisa);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Format a date in Asia/Dhaka as YYYY-MM-DD HH:mm. */
export function dhakaStamp(d: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
}
