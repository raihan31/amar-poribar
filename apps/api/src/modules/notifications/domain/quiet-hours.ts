const toMinutes = (hhmm: string): number => {
  const [h = "0", m = "0"] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
};

/** Minutes since local midnight of `now` in `tz`. */
function localMinutes(now: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return (get("hour") % 24) * 60 + get("minute");
}

/**
 * True when `now` falls inside the quiet window (FR-NOTIF-05). `start < end` is a same-day window, `start > end`
 * wraps midnight (default 22:00-06:00), and `start == end` is never quiet. Start is inclusive, end exclusive.
 */
export function isQuietAt(now: Date, quietStart: string, quietEnd: string, tz = "Asia/Dhaka"): boolean {
  const start = toMinutes(quietStart);
  const end = toMinutes(quietEnd);
  if (start === end) return false;
  const t = localMinutes(now, tz);
  return start < end ? t >= start && t < end : t >= start || t < end;
}
