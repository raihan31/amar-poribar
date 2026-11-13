import { http, HttpResponse, type HttpHandler } from "msw";
import { familyFixture } from "../components/family/types";
import { healthFixture } from "../components/health/types";
import type { AuditItem } from "../lib/audit/types";
import { MOCK_NOW_ISO, MOCK_PASSWORD, MOCK_TOTP_SECRET } from "./constants";
import { privacyFixture, staffFixture } from "./fixtures";
import { totpValid } from "./totp";

/**
 * Stateful stand-in for the admin API, used only when the Next server runs with AP_MOCK=1 (`pnpm e2e:mock`).
 * It mirrors the contract the real API must meet: TOTP sign-in, lockout after five failures, role checks,
 * `reason_required`, typed family-name confirmation, and an audit log that records every action.
 */
const LOCK_SECONDS = 15 * 60;
const MIN_REASON = 10;

type Role = "owner" | "support" | "readonly";
type Need = "change_plan" | "suspend" | "delete_data";
interface Account {
  email: string;
  name: string;
  role: Role;
  fails: number;
  lockedUntil: number;
}

const accounts = new Map<string, Account>(
  (
    [
      ["owner@amar.test", "Olivia Owner", "owner"],
      ["support@amar.test", "Sam Support", "support"],
      ["readonly@amar.test", "Rita Readonly", "readonly"],
      ["locked@amar.test", "Lena Locked", "support"],
    ] as const
  ).map(([email, name, role]) => [email, { email, name, role, fails: 0, lockedUntil: 0 }]),
);

/** Offset added to "now" by the test-only clock control (a `mockAdvanceSeconds` field on the login call). */
let clockOffsetMs = 0;
const now = () => Date.now() + clockOffsetMs;

const challenges = new Map<string, string>();
let suspended = false;
let nextAuditId = 215;
const audit: AuditItem[] = [
  {
    id: 214,
    at: "2026-11-11T03:12:00Z",
    staffName: "Rubel",
    action: "Changed plan",
    kind: "change",
    familyName: "মিয়া পরিবার",
    reason: "Upgrade requested by phone",
  },
];

const err = (code: string, status: number, extra: Record<string, unknown> = {}) =>
  HttpResponse.json({ error: { code, ...extra } }, { status });

function staffFrom(request: Request): Account | undefined {
  const m = /^Bearer mock\.([a-z]+)\.(.+)$/.exec(request.headers.get("authorization") ?? "");
  if (!m) return undefined;
  return [...accounts.values()].find((a) => a.role === m[1] && a.email === decodeURIComponent(m[2]!));
}

const ACTIONS: Record<string, { label: string; kind: AuditItem["kind"]; need: Need }> = {
  plan: { label: "Changed plan", kind: "change", need: "change_plan" },
  quota: { label: "Added AI entries", kind: "change", need: "change_plan" },
  suspend: { label: "Suspended family", kind: "risky", need: "suspend" },
  unsuspend: { label: "Unsuspended family", kind: "risky", need: "suspend" },
  delete: { label: "Requested family deletion", kind: "risky", need: "delete_data" },
};

const ALLOWED: Record<Role, Need[]> = {
  owner: ["change_plan", "suspend", "delete_data"],
  support: ["change_plan"],
  readonly: [],
};

function rows() {
  const base = familyFixture();
  return [
    {
      id: base.id,
      name: base.name,
      ownerPhoneMasked: "••• 678",
      members: 4,
      plan: base.plan,
      aiUsed: 93,
      aiLimit: 100,
      lastActiveAt: "2026-11-11T03:00:00Z",
      status: suspended ? "suspended" : "active",
    },
    {
      id: "fam_2b71c0aa9e1",
      name: "মিয়া পরিবার",
      ownerPhoneMasked: "••• 245",
      members: 6,
      plan: "plus",
      aiUsed: 412,
      aiLimit: 1000,
      lastActiveAt: "2026-11-10T03:00:00Z",
      status: "active",
    },
    {
      id: "fam_77de10c4f02",
      name: "করিম পরিবার",
      ownerPhoneMasked: null,
      members: 2,
      plan: "free",
      aiUsed: 3,
      aiLimit: 100,
      lastActiveAt: null,
      status: "no_owner",
    },
  ];
}

export const e2eHandlers: HttpHandler[] = [
  http.post("*/admin/v1/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string; mockAdvanceSeconds?: number };
    if (body.mockAdvanceSeconds) {
      clockOffsetMs += body.mockAdvanceSeconds * 1000;
      return HttpResponse.json({ ok: true });
    }
    const acct = accounts.get((body.email ?? "").toLowerCase());
    if (acct && acct.lockedUntil > now()) {
      return err("account_locked", 423, { retryAfterSeconds: Math.ceil((acct.lockedUntil - now()) / 1000) });
    }
    if (!acct || body.password !== MOCK_PASSWORD) {
      if (acct && ++acct.fails >= 5) {
        acct.fails = 0;
        acct.lockedUntil = now() + LOCK_SECONDS * 1000;
        return err("account_locked", 423, { retryAfterSeconds: LOCK_SECONDS });
      }
      return err("invalid_credentials", 401);
    }
    acct.fails = 0;
    const challengeId = `ch_${challenges.size + 1}_${now()}`;
    challenges.set(challengeId, acct.email);
    return HttpResponse.json({ status: "totp_required", challengeId });
  }),
  http.post("*/admin/v1/auth/totp", async ({ request }) => {
    const { challengeId, code } = (await request.json()) as { challengeId?: string; code?: string };
    const email = challenges.get(challengeId ?? "");
    const acct = email ? accounts.get(email) : undefined;
    if (!acct) return err("totp_expired", 401);
    if (!totpValid(MOCK_TOTP_SECRET, code ?? "")) return err("totp_invalid", 401, { attemptsLeft: 4 });
    challenges.delete(challengeId!);
    return HttpResponse.json({
      token: `mock.${acct.role}.${encodeURIComponent(acct.email)}`,
      name: acct.name,
      role: acct.role,
    });
  }),
  http.get("*/admin/v1/me", ({ request }) => {
    const a = staffFrom(request);
    return a ? HttpResponse.json({ name: a.name, role: a.role }) : err("unauthorized", 401);
  }),
  // A staff token is never valid on family routes.
  http.get("*/v1/me", () => err("unauthorized", 401)),
  http.get("*/admin/v1/families", () => {
    const items = rows();
    return HttpResponse.json({ items, total: items.length, nextCursor: null });
  }),
  http.get("*/admin/v1/families/:id", () =>
    HttpResponse.json({
      ...familyFixture(),
      pendingInvites: [{ phoneMasked: "••• 432", expiresAt: "2026-11-16T16:00:00Z" }],
      status: suspended ? "suspended" : "active",
    }),
  ),
  http.post("*/admin/v1/families/:id/:action", async ({ request, params }) => {
    const staff = staffFrom(request);
    if (!staff) return err("unauthorized", 401);
    const def = ACTIONS[String(params.action)];
    if (!def) return err("not_found", 404);
    if (!ALLOWED[staff.role].includes(def.need)) return err("forbidden", 403);
    const body = (await request.json().catch(() => ({}))) as { reason?: string; confirmFamilyName?: string };
    if ((body.reason ?? "").trim().length < MIN_REASON) return err("reason_required", 422);
    const fam = familyFixture();
    if ((def.need === "suspend" || def.need === "delete_data") && body.confirmFamilyName !== fam.name) {
      return err("confirmation_mismatch", 422);
    }
    if (params.action === "suspend") suspended = true;
    if (params.action === "unsuspend") suspended = false;
    audit.unshift({
      id: nextAuditId++,
      at: new Date(now()).toISOString(),
      staffName: staff.name,
      action: def.label,
      kind: def.kind,
      familyName: fam.name,
      reason: body.reason!.trim(),
    });
    return HttpResponse.json(
      params.action === "delete" ? { ok: true, scheduledFor: "2026-12-13T00:00:00Z" } : { ok: true },
    );
  }),
  http.get("*/admin/v1/audit", () =>
    HttpResponse.json({
      items: audit,
      nextCursor: null,
      total: audit.length,
      chain: { ok: true, verifiedThrough: Number(audit[0]!.id) },
    }),
  ),
  // Data relative to "now" is pinned so visual snapshots do not drift from day to day.
  http.get("*/admin/v1/staff", () => HttpResponse.json(staffFixture(new Date(MOCK_NOW_ISO)))),
  http.get("*/admin/v1/privacy-requests", ({ request }) => {
    const status = new URL(request.url).searchParams.get("status") ?? "open";
    const f = privacyFixture(new Date(MOCK_NOW_ISO));
    return HttpResponse.json(status === "open" ? f : { items: [], counts: f.counts });
  }),
  http.get("*/admin/v1/health", () => HttpResponse.json(healthFixture)),
];
