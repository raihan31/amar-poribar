const BN_PERIODS: Array<[number, string]> = [
  [4, "রাত"],
  [6, "ভোর"],
  [12, "সকাল"],
  [15, "দুপুর"],
  [18, "বিকাল"],
  [20, "সন্ধ্যা"],
  [24, "রাত"],
];

function bnPeriod(h: number): string {
  return BN_PERIODS.find(([limit]) => h < limit)![1];
}

export interface ClockOpts {
  /** Drop ":00" ("রাত ১০টা" / "10 PM"). */
  short?: boolean;
}

/** `"21:00"` becomes "রাত ৯:০০" (bn) or "9:00 PM" (en); digits come from the caller's `num`. */
export function formatClock(
  hhmm: string,
  locale: "bn" | "en",
  num: (n: number) => string,
  opts: ClockOpts = {},
): string {
  const [hs = "0", ms = "0"] = hhmm.split(":");
  const h = Number(hs);
  const m = Number(ms);
  const h12 = h % 12 || 12;
  const mm = m < 10 ? `${num(0)}${num(m)}` : num(m);
  const whole = opts.short && m === 0;
  if (locale === "bn") {
    return `${bnPeriod(h)} ${whole ? `${num(h12)}টা` : `${num(h12)}:${mm}`}`;
  }
  const ampm = h < 12 ? "AM" : "PM";
  return `${whole ? num(h12) : `${num(h12)}:${mm}`} ${ampm}`;
}
