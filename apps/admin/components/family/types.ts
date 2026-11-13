import type { FamilyPlan, FamilyStatus } from "@/lib/api/hooks/useFamilies";

export type MemberRole = "owner" | "admin" | "member" | "viewer";

export interface FamilyMember {
  userId?: string;
  displayName: string;
  phoneMasked: string;
  role: MemberRole;
}

export interface PendingInvite {
  phoneMasked: string;
  expiresAt: string;
}

export interface StaffAction {
  id?: string | number;
  action: string;
  reason?: string | null;
  staffName: string;
  at: string;
}

export interface FamilyDetail {
  id: string;
  name: string;
  createdAt: string;
  status: FamilyStatus;
  members: FamilyMember[];
  pendingInvites: PendingInvite[];
  plan: FamilyPlan;
  ai: { used: number; limit: number; resetsOn: string; costPaisa: number };
  usage: { entries: number; voiceShare: number; devices: number; lastSyncAt: string | null };
  recentActions: StaffAction[];
  deletionScheduledFor?: string | null;
}

const TZ = "Asia/Dhaka";
const dayMonth = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" });
const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});
const hm = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });

export const fmtDay = (iso: string) => dayMonth.format(new Date(iso));
export const fmtDate = (iso: string) => dayMonthYear.format(new Date(iso));

/** `Today, 09:41` or `2 Nov, 09:41` in Asia/Dhaka. */
export function fmtSync(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const time = hm.format(d);
  return ymd.format(d) === ymd.format(now) ? `Today, ${time}` : `${dayMonth.format(d)}, ${time}`;
}

/** Integer paisa to `৳ 9.8` without floating point. */
export function fmtTaka(paisa: number): string {
  const whole = Math.trunc(paisa / 100);
  const frac = String(Math.abs(paisa % 100))
    .padStart(2, "0")
    .replace(/0+$/, "");
  return `৳ ${whole}${frac ? `.${frac}` : ""}`;
}

/** `fam_8f2c…41a` */
export function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-3)}` : id;
}

export const familyFixture = (): FamilyDetail => ({
  id: "fam_8f2c9d0e7b6a41a",
  name: "রহিম পরিবার",
  createdAt: "2026-08-03T05:00:00Z",
  status: "active",
  members: [
    { userId: "u1", displayName: "আব্বু", phoneMasked: "••• 678", role: "owner" },
    { userId: "u2", displayName: "আম্মু", phoneMasked: "••• 321", role: "admin" },
    { userId: "u3", displayName: "দাদি", phoneMasked: "••• 457", role: "member" },
    { userId: "u4", displayName: "তানভীর", phoneMasked: "••• 904", role: "viewer" },
  ],
  pendingInvites: [{ phoneMasked: "••• 432", expiresAt: new Date(Date.now() + 5.5 * 86_400_000).toISOString() }],
  plan: "free",
  ai: { used: 93, limit: 100, resetsOn: "2026-12-01", costPaisa: 980 },
  usage: { entries: 212, voiceShare: 34, devices: 6, lastSyncAt: "2026-11-12T03:41:00Z" },
  recentActions: [
    { id: 1, action: "Added 50 AI entries", reason: "pilot", staffName: "Rubel", at: "2026-11-02T05:00:00Z" },
    { id: 2, action: "Viewed family page", staffName: "Support", at: "2026-10-30T05:00:00Z" },
    { id: 3, action: "Reset member invite link", staffName: "Rubel", at: "2026-10-12T05:00:00Z" },
  ],
});
