export type TileStatus = "ok" | "warn" | "risk";

export interface HealthTile {
  key: string;
  label: string;
  value: string | number;
  unit: string;
  status: TileStatus;
  note: string;
}

export interface HealthBackups {
  lastAt: string;
  keptDays: number;
  lastRestoreAt: string;
  lastRestoreOk: boolean;
  nextRestoreAt: string;
}

export interface HealthIncident {
  title: string;
  startedAt: string;
  note: string;
  state: "watching" | "resolved";
}

export interface Health {
  asOf: string;
  tiles: HealthTile[];
  backups: HealthBackups;
  queue: { depth: number; deadLetters: number };
  incidents: HealthIncident[];
}

const dhaka = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour12: false, ...opts }).format(new Date(iso));

export const dateTimeText = (iso: string) =>
  dhaka(iso, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const dayText = (iso: string) => dhaka(iso, { day: "numeric", month: "short", year: "numeric" });
export const shortStamp = (iso: string) =>
  dhaka(iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Fixture reproducing the AdminHealth design tiles, with the SRS NFR-08 weekly restore cadence. */
export const healthFixture: Health = {
  asOf: "2026-11-11T04:00:00Z",
  tiles: [
    {
      key: "api_availability",
      label: "API availability",
      value: "99.71",
      unit: "%",
      status: "ok",
      note: "Meets 99.5% target",
    },
    { key: "api_p95", label: "p95 API latency (CRUD)", value: 212, unit: "ms", status: "ok", note: "Under 300 ms" },
    {
      key: "otp_delivery",
      label: "OTP delivery rate",
      value: "95.8",
      unit: "%",
      status: "warn",
      note: "Below usual 98.5%",
    },
    {
      key: "push_delivery",
      label: "Push (FCM) delivery rate",
      value: "97.4",
      unit: "%",
      status: "ok",
      note: "Normal",
    },
    { key: "sms_gateway", label: "SMS gateway", value: "Slow", unit: "", status: "warn", note: "Median send time 9 s" },
    {
      key: "ai_errors",
      label: "AI errors and template fallback",
      value: "1.3",
      unit: "%",
      status: "ok",
      note: "Normal · fallback used 41 times",
    },
  ],
  backups: {
    lastAt: "2026-11-10T21:00:00Z",
    keptDays: 14,
    lastRestoreAt: "2026-11-08T21:00:00Z",
    lastRestoreOk: true,
    nextRestoreAt: "2026-11-15T21:00:00Z",
  },
  queue: { depth: 3, deadLetters: 0 },
  incidents: [
    {
      title: "OTP delays on one gateway route",
      startedAt: "2026-11-11T01:40:00Z",
      note: "switched to backup route",
      state: "watching",
    },
    {
      title: "AI provider slow for 12 minutes",
      startedAt: "2026-11-06T08:05:00Z",
      note: "fallback template used",
      state: "resolved",
    },
    {
      title: "Push delay after app release",
      startedAt: "2026-10-28T05:30:00Z",
      note: "token refresh fixed",
      state: "resolved",
    },
  ],
};
