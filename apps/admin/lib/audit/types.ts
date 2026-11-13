export type AuditKind = "risky" | "privacy" | "read" | "change" | "signin" | "security";

export interface AuditItem {
  id: number | string;
  at: string;
  staffName: string;
  action: string;
  kind: AuditKind;
  familyName: string | null;
  reason: string | null;
}

export interface ChainMeta {
  ok: boolean;
  verifiedThrough?: number | string;
  brokenAt?: number | string;
}

export interface AuditList {
  items: AuditItem[];
  nextCursor: string | null;
  total: number;
  chain: ChainMeta;
}

export interface AuditFilterValue {
  staff: string;
  action: string;
  family: string;
  range: "7d" | "30d" | "custom";
  from: string;
  to: string;
}

export const ACTIONS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "auth.signed_in", label: "Signed in" },
  { value: "plan.changed", label: "Changed plan" },
  { value: "ai.quota_added", label: "Added AI entries" },
  { value: "family.suspended", label: "Suspended family" },
  { value: "family.viewed", label: "Viewed family page" },
  { value: "privacy.started", label: "Started privacy request" },
  { value: "auth.failed", label: "Failed sign-in" },
];

/** The verify route is added by the T-ADM audit task; the button stays hidden until it is in apps/api/openapi.json. */
export const VERIFY_IN_OPENAPI = false;

const MS_DAY = 86_400_000;

/** Turns URL filters into the API query string (no cursor). */
export function toQuery(f: AuditFilterValue, now: Date = new Date()): URLSearchParams {
  const q = new URLSearchParams();
  if (f.staff) q.set("staff", f.staff);
  if (f.action) q.set("action", f.action);
  if (f.family) q.set("family", f.family);
  if (f.range === "custom") {
    if (f.from) q.set("from", f.from);
    if (f.to) q.set("to", f.to);
  } else {
    const days = f.range === "7d" ? 7 : 30;
    q.set("from", new Date(now.getTime() - days * MS_DAY).toISOString());
  }
  return q;
}

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** `11 Nov, 09:12` in Asia/Dhaka. */
export function formatWhen(iso: string): string {
  const p = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day} ${p.month}, ${p.hour}:${p.minute}`;
}
