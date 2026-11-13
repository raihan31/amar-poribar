import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openE2e, type E2e } from "../support/e2e.js";

let e: E2e;
let A: string, B: string, C: string, F: string;
let cats: { id: string; key: string }[];
let accs: { id: string }[];
let inviteToken: string;
let bId: string;

beforeAll(async () => {
  e = await openE2e();
  [A, B, C] = await Promise.all([e.login("01710000001"), e.login("01810000001"), e.login("01910000001")]);
});
afterAll(() => e.dispose());

describe("families, invites, accounts and categories (e2e)", () => {
  it("create family", async () => {
    const fam = await e.call("POST", "/v1/families", { token: A, body: { name: "Test পরিবার" } });
    expect(fam.status).toBe(201);
    F = fam.json.id;
  });

  it("seeded categories/accounts", async () => {
    cats = (await e.call("GET", `/v1/families/${F}/categories`, { token: A })).json;
    accs = (await e.call("GET", `/v1/families/${F}/accounts`, { token: A })).json;
    expect(cats.length).toBeGreaterThan(20);
    expect(accs).toHaveLength(2);
  });

  it("create invite, accept it, and it is single use", async () => {
    const inv = await e.call("POST", `/v1/families/${F}/invites`, { token: A, body: { role: "member" } });
    expect(inv.status).toBe(201);
    expect(inv.json.token).toBeTruthy();
    inviteToken = inv.json.token;
    expect((await e.call("POST", `/v1/invites/${inviteToken}/accept`, { token: B, body: {} })).status).toBe(200);
    expect((await e.call("POST", `/v1/invites/${inviteToken}/accept`, { token: C, body: {} })).status).toBe(409);
  });

  it("viewer joins and the family has 3 members", async () => {
    const invV = await e.call("POST", `/v1/families/${F}/invites`, { token: A, body: { role: "viewer" } });
    expect((await e.call("POST", `/v1/invites/${invV.json.token}/accept`, { token: C, body: {} })).status).toBe(200);
    const members = (await e.call("GET", `/v1/families/${F}/members`, { token: A })).json;
    expect(members).toHaveLength(3);
    bId = members.find((m: { role: string }) => m.role === "member").userId;
  });

  let nagadId: string;
  it("create account", async () => {
    const na = await e.call("POST", `/v1/families/${F}/accounts`, {
      token: A,
      body: { name: "Nagad", type: "nagad", ownerUserId: bId },
    });
    expect(na.status).toBe(201);
    nagadId = na.json.id;
  });

  it("account owner must be a member", async () => {
    const res = await e.call("POST", `/v1/families/${F}/accounts`, {
      token: A,
      body: { name: "X", type: "cash", ownerUserId: randomUUID() },
    });
    expect(res.status).toBe(400);
  });

  it("archive account, hide it from the list, show it with includeArchived", async () => {
    const archived = await e.call("PATCH", `/v1/families/${F}/accounts/${nagadId}`, {
      token: A,
      body: { archived: true },
    });
    expect(archived.json.archivedAt).toBeTruthy();
    const list = (await e.call("GET", `/v1/families/${F}/accounts`, { token: A })).json;
    expect(list.some((a: { id: string }) => a.id === nagadId)).toBe(false);
    const all = (await e.call("GET", `/v1/families/${F}/accounts?includeArchived=true`, { token: A })).json;
    expect(all.some((a: { id: string }) => a.id === nagadId)).toBe(true);
  });

  it("create and hide a custom category", async () => {
    const nc = await e.call("POST", `/v1/families/${F}/categories`, {
      token: A,
      body: { kind: "expense", nameEn: "Pets", nameBn: "পোষা প্রাণী", icon: "🐈" },
    });
    expect(nc.status).toBe(201);
    expect(nc.json.key.startsWith("custom_")).toBe(true);
    const hidden = await e.call("PATCH", `/v1/families/${F}/categories/${nc.json.id}`, {
      token: A,
      body: { isHidden: true },
    });
    expect(hidden.json.isHidden).toBe(true);
  });
});
