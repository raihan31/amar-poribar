const FIELD_RANGES: readonly [number, number][] = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
];

function expand(field: string, [lo, hi]: [number, number]): Set<number> {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    const [range = "", stepStr] = part.split("/");
    const step = stepStr ? Number(stepStr) : 1;
    let a: number;
    let b: number;
    if (range === "*") [a, b] = [lo, hi];
    else if (range.includes("-")) [a, b] = range.split("-").map(Number) as [number, number];
    else {
      a = Number(range);
      b = stepStr ? hi : a;
    }
    if (![a, b, step].every(Number.isInteger) || step < 1 || a < lo || b > hi || a > b)
      throw new Error(`invalid cron field: ${field}`);
    for (let v = a; v <= b; v += step) out.add(v);
  }
  return out;
}

export function parseCron(cron: string): Set<number>[] {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`cron must have 5 fields: ${cron}`);
  return fields.map((f, i) => expand(f, FIELD_RANGES[i]!));
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** True when the minute containing `at` matches `cron` in the wall clock of `tz`. */
export function cronMatches(cron: string, at: Date, tz: string): boolean {
  const [min, hour, dom, mon, dow] = parseCron(cron) as [
    Set<number>,
    Set<number>,
    Set<number>,
    Set<number>,
    Set<number>,
  ];
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      minute: "numeric",
      hour: "numeric",
      day: "numeric",
      month: "numeric",
      weekday: "short",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return (
    min.has(Number(parts.minute)) &&
    hour.has(Number(parts.hour)) &&
    dom.has(Number(parts.day)) &&
    mon.has(Number(parts.month)) &&
    dow.has(WEEKDAYS.indexOf(parts.weekday ?? ""))
  );
}
