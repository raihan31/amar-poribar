import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nowIso, openE2e, type E2e } from "../support/e2e.js";

let e: E2e;
let A: string, B: string, C: string, D: string, F: string;
let members: { userId: string; role: string }[];
const idOf = (role: string) => members.find((m) => m.role === role)!.userId;

beforeAll(async () => {
  e = await openE2e();
  [A, B, C, D] = await Promise.all([
    e.login("01710000002"),
    e.login("01810000002"),
    e.login("01910000002"),
    e.login("01610000002"),
  ]);
  F = (await e.call("POST", "/v1/families", { token: A, body: { name: "Roles পরিবার" } })).json.id;
  for (const [token, role] of [
    [B, "member"],
    [C, "viewer"],
  ] as const) {
    const inv = await e.call("POST", `/v1/families/${F}/invites`, { token: A, body: { role } });
    await e.call("POST", `/v1/invites/${inv.json.token}/accept`, { token, body: {} });
  }
  members = (await e.call("GET", `/v1/families/${F}/members`, { token: A })).json;
});
afterAll(() => e.dispose());

describe("roles (e2e)", () => {
  it("member cannot invite", async () => {
    expect((await e.call("POST", `/v1/families/${F}/invites`, { token: B, body: {} })).status).toBe(403);
  });

  it("owner promotes member to admin", async () => {
    const res = await e.call("PATCH", `/v1/families/${F}/members/${idOf("member")}`, {
      token: A,
      body: { role: "admin" },
    });
    expect(res.status).toBe(200);
  });

  it("admin cannot remove the owner", async () => {
    expect((await e.call("DELETE", `/v1/families/${F}/members/${idOf("owner")}`, { token: B })).status).toBe(403);
  });

  it("admin cannot make another admin", async () => {
    expect((await e.call("POST", `/v1/families/${F}/invites`, { token: B, body: { role: "admin" } })).status).toBe(403);
  });

  it("outsider gets 404", async () => {
    expect((await e.call("GET", `/v1/families/${F}/members`, { token: D })).status).toBe(404);
  });

  it("viewer cannot list transactions", async () => {
    expect((await e.call("GET", `/v1/families/${F}/transactions`, { token: C })).status).toBe(403);
  });

  it("viewer cannot export csv", async () => {
    expect((await e.call("GET", `/v1/families/${F}/reports/export.csv`, { token: C })).status).toBe(403);
  });

  it("viewer cannot set budgets", async () => {
    const { month } = nowIso();
    const res = await e.call("PUT", `/v1/families/${F}/budgets?month=${month}`, {
      token: C,
      body: { budgets: [{ categoryId: null, limitPaisa: 1 }] },
    });
    expect(res.status).toBe(403);
  });

  it("viewer cannot sync", async () => {
    expect((await e.call("POST", `/v1/families/${F}/sync`, { token: C, body: { nodeId: "v" } })).status).toBe(403);
  });
});
