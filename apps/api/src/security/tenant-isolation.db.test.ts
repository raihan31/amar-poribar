import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../../tests/support/app-test.js";
import { withTestDb } from "../../tests/support/db-test.js";
import {
  ROUTE_FIXTURES,
  seedFamilyA,
  seedOutsiderMember,
  type Call,
  type RouteRequest,
  type TenantCtx,
} from "./route-fixtures.js";

/** Automatic tenant-isolation test (SRS 11.2, NFR-06, AC-07). */

const METHODS = ["get", "post", "put", "patch", "delete"] as const;
type Method = (typeof METHODS)[number];

interface Operation {
  key: string;
  method: Method;
  path: string;
}

interface Allowance {
  operation: string;
  status: number;
  reason: string;
}

const openapi = JSON.parse(readFileSync(new URL("../../openapi.json", import.meta.url), "utf8")) as {
  paths: Record<string, Partial<Record<Method, object>>>;
};
const allowlist = (
  JSON.parse(readFileSync(new URL("./tenant-allowlist.json", import.meta.url), "utf8")) as { allow: Allowance[] }
).allow;

/** Path parameters that name a family-scoped resource: any `...Id` (a user id on its own is not one). */
function scopedParams(path: string): string[] {
  const ids = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).filter((n) => /Id$/.test(n));
  // `userId` and `deviceId` (`/v1/me/devices/{deviceId}`) are scoped to the caller, not to a family.
  return ids.length === 1 && (ids[0] === "userId" || ids[0] === "deviceId") ? [] : ids;
}

const operations: Operation[] = Object.entries(openapi.paths).flatMap(([path, item]) =>
  METHODS.filter((m) => item[m] && scopedParams(path).length > 0).map((method) => ({
    key: `${method.toUpperCase()} ${path}`,
    method,
    path,
  })),
);
const cases = operations.map((o) => [o.key, o] as const);

function buildUrl(op: Operation, req: RouteRequest): string {
  const path = op.path.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = req.params[name];
    if (!v) throw new Error(`fixture for ${op.key} has no value for {${name}}`);
    return encodeURIComponent(v);
  });
  const qs = new URLSearchParams(req.query ?? {}).toString();
  return qs ? `${path}?${qs}` : path;
}

describe("tenant isolation: coverage", () => {
  it("selects the family-scoped operations of openapi.json", () => {
    expect(operations.map((o) => o.key)).toContain("GET /v1/families/{familyId}/transactions");
  });

  it("every family-scoped operation has a route fixture", () => {
    const missing = operations.map((o) => o.key).filter((k) => !(k in ROUTE_FIXTURES));
    expect(missing, `add fixtures to route-fixtures.ts for: ${missing.join(", ")}`).toEqual([]);
  });

  it("fixtures and allow-list name only existing operations, with reasons", () => {
    const known = new Set(operations.map((o) => o.key));
    const stale = [...Object.keys(ROUTE_FIXTURES), ...allowlist.map((a) => a.operation)].filter((k) => !known.has(k));
    expect(stale, `remove stale keys: ${stale.join(", ")}`).toEqual([]);
    for (const a of allowlist) expect(a.reason.trim(), `${a.operation} needs a reason`).not.toBe("");
  });
});

// The families and ledger tables are created by the module moves (T-PLAT-24, 25); until their migrations exist
// there is no family to attack, exactly like fixtures.db.test.ts.
const hasAppTables = await withTestDb(async ({ sql }) => {
  const r = await sql<{ ident: string | null; fam: string | null; ledger: string | null; rest: boolean }[]>`
    select coalesce(to_regclass('public.users')::text, to_regclass('identity.users')::text) as ident,
           coalesce(to_regclass('public.family_members')::text, to_regclass('families.family_members')::text) as fam,
           coalesce(to_regclass('public.categories')::text, to_regclass('ledger.categories')::text) as ledger,
           (coalesce(to_regclass('public.budgets'), to_regclass('budgeting.budgets')) is not null
            and coalesce(to_regclass('public.festival_budgets'), to_regclass('budgeting.festival_budgets')) is not null
            and coalesce(to_regclass('public.recurring_templates'), to_regclass('recurring.recurring_templates')) is not null
            and coalesce(to_regclass('public.ai_usage'), to_regclass('ai.ai_usage')) is not null) as rest`;
  // Every route is attacked, so the budgets, recurring and AI tables (T-PLAT-26..30) must exist too.
  return Boolean(r[0]?.ident) && Boolean(r[0]?.fam) && Boolean(r[0]?.ledger) && r[0]?.rest === true;
});

describe.skipIf(!hasAppTables)("tenant isolation: outsider", () => {
  let call: Call;
  let ctx: TenantCtx;
  let ownerA: string;
  let outsider: string;
  let release: () => void = () => {};
  let closed: Promise<void> = Promise.resolve();

  beforeAll(async () => {
    await new Promise<void>((ready, fail) => {
      closed = withTestDb(async ({ db, sql }) => {
        const t = await buildTestApp({ db, sql });
        try {
          call = async (method, url, opts) => {
            const res = await t.app.inject({
              method,
              url,
              payload: opts?.body as Record<string, unknown> | undefined,
              headers: opts?.token ? { authorization: `Bearer ${opts.token}` } : undefined,
            });
            let body: unknown = res.body;
            try {
              body = JSON.parse(res.body);
            } catch {
              /* plain text, e.g. CSV */
            }
            return { status: res.statusCode, body, headers: res.headers };
          };
          const a = await t.login("01712345678");
          const b = await t.login("01812345678");
          const m = await t.login("01912345678");
          ownerA = a.accessToken;
          ctx = await seedFamilyA(call, a.accessToken);
          await seedOutsiderMember(call, b.accessToken, m.accessToken);
          outsider = m.accessToken;
          ready();
          await new Promise<void>((r) => (release = r));
        } finally {
          await t.close();
        }
      }).catch(fail);
    });
  });
  afterAll(async () => {
    release();
    await closed;
  });

  const send = (op: Operation, token?: string) => {
    const req = ROUTE_FIXTURES[op.key]!(ctx);
    return call(op.method.toUpperCase() as Parameters<Call>[0], buildUrl(op, req), { token, body: req.body });
  };

  // Guards the test itself: a fixture with a wrong id would also answer 404, so read routes must work for A.
  it.each(cases.filter(([, op]) => op.method === "get"))("owner of family A can reach %s", async (_k, op) => {
    expect((await send(op, ownerA)).status).not.toBe(404);
  });

  it.each(cases)("outsider gets 404 on %s", async (key, op) => {
    const res = await send(op, outsider);
    const allowed = allowlist.find((a) => a.operation === key);
    if (allowed) return expect(res.status).toBe(allowed.status);
    expect(res.status).toBe(404);
    expect((res.body as { error?: { code?: string } }).error?.code).toBe("not_found");
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it.each(cases)("unauthenticated gets 401 on %s", async (_k, op) => {
    expect((await send(op)).status).toBe(401);
  });
});
