/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- response bodies are untyped JSON */
import { buildTestApp, type TestApp } from "./app-test.js";
import { createTestDb, type OwnedTestDb } from "./db-test.js";

/** Response of `E2e.call`: JSON bodies are parsed, anything else leaves `json` undefined. */
export interface Res {
  status: number;
  // The e2e checks read many shapes; the contract vectors cover the typed side.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any;
  text: string;
  raw: Buffer;
}

export interface CallOptions {
  token?: string;
  body?: unknown;
}

export interface E2e {
  t: TestApp;
  call(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, opts?: CallOptions): Promise<Res>;
  /** OTP login; returns the access token. */
  login(phone: string): Promise<string>;
  dispose(): Promise<void>;
}

/** A migrated database plus the full app wired with fakes, for the converted end-to-end suites. */
export async function openE2e(): Promise<E2e> {
  const dbs: OwnedTestDb = await createTestDb();
  const t = await buildTestApp({ db: dbs.db, sql: dbs.sql });
  return {
    t,
    async call(method, path, { token, body } = {}) {
      const res = await t.app.inject({
        method,
        url: path,
        ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
        ...(body !== undefined ? { payload: body as object } : {}),
      });
      let json: unknown;
      try {
        json = JSON.parse(res.body);
      } catch {
        json = undefined;
      }
      return { status: res.statusCode, json, text: res.body, raw: res.rawPayload };
    },
    login: async (phone) => (await t.login(phone)).accessToken,
    async dispose() {
      await t.close();
      await dbs.drop();
    },
  };
}

export interface Seeded {
  /** Owner, admin and viewer tokens. */
  A: string;
  B: string;
  C: string;
  /** Family id. */
  F: string;
  cats: { id: string; key: string; kind: string }[];
  accs: { id: string; name: string }[];
  /** Admin's user id. */
  bId: string;
}

/** Owner A creates a family; B joins as member and is promoted to admin; C joins as viewer. */
export async function seedFamily(e: E2e, phones: [string, string, string]): Promise<Seeded> {
  const [A, B, C] = await Promise.all(phones.map((p) => e.login(p))).then((x) => x as [string, string, string]);
  const fam = await e.call("POST", "/v1/families", { token: A, body: { name: "Test পরিবার" } });
  const F = fam.json.id as string;
  const cats = (await e.call("GET", `/v1/families/${F}/categories`, { token: A })).json;
  const accs = (await e.call("GET", `/v1/families/${F}/accounts`, { token: A })).json;
  const join = async (token: string, role: string) => {
    const inv = await e.call("POST", `/v1/families/${F}/invites`, { token: A, body: { role } });
    await e.call("POST", `/v1/invites/${inv.json.token}/accept`, { token, body: {} });
  };
  await join(B, "member");
  await join(C, "viewer");
  const members = (await e.call("GET", `/v1/families/${F}/members`, { token: A })).json as {
    userId: string;
    role: string;
  }[];
  const bId = members.find((m) => m.role === "member")!.userId;
  await e.call("PATCH", `/v1/families/${F}/members/${bId}`, { token: A, body: { role: "admin" } });
  return { A, B, C, F, cats, accs, bId };
}

/** ISO timestamp of "now", plus today's date and month (`YYYY-MM`) in Asia/Dhaka, as the API reckons them. */
export function nowIso(): { now: string; month: string; today: string } {
  const d = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);
  return { now: d.toISOString(), month: today.slice(0, 7), today };
}
