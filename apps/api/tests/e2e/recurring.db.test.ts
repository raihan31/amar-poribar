import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nowIso, openE2e, seedFamily, type E2e, type Seeded } from "../support/e2e.js";

let e: E2e;
let s: Seeded;
const { month } = nowIso();
let templateId: string;

beforeAll(async () => {
  e = await openE2e();
  s = await seedFamily(e, ["01710000005", "01810000005", "01910000005"]);
});
afterAll(() => e.dispose());

const drafts = async () =>
  (await e.call("GET", `/v1/families/${s.F}/recurring/drafts?month=${month}`, { token: s.B })).json.drafts as unknown[];
const confirm = () =>
  e.call("POST", `/v1/families/${s.F}/recurring/${templateId}/confirm?month=${month}`, { token: s.B, body: {} });

describe("recurring (e2e)", () => {
  it("recurring create", async () => {
    const rc = await e.call("POST", `/v1/families/${s.F}/recurring`, {
      token: s.A,
      body: {
        name: "House rent",
        amountPaisa: 1200000,
        dayOfMonth: 31,
        startsOn: "2026-01-01",
        categoryId: s.cats.find((c) => c.key === "rent")!.id,
      },
    });
    expect(rc.status, rc.text).toBe(201);
    templateId = rc.json.id;
  });

  it("recurring draft is due", async () => {
    expect(await drafts()).toHaveLength(1);
  });

  it("recurring confirms once, the second confirm is 409", async () => {
    expect((await confirm()).status).toBe(201);
    expect((await confirm()).status).toBe(409);
  });

  it("recurring draft is gone after confirming", async () => {
    expect(await drafts()).toHaveLength(0);
  });

  it("reminders endpoint answers", async () => {
    expect((await e.call("GET", `/v1/families/${s.F}/recurring/reminders`, { token: s.B })).status).toBe(200);
  });
});
