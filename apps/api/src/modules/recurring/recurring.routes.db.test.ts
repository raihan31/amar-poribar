import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";

async function createFamily(t: TestApp, tokens: Tokens): Promise<string> {
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(tokens),
    payload: { name: "রহিম পরিবার" },
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

async function firstCategory(t: TestApp, tokens: Tokens, familyId: string): Promise<string> {
  const res = await t.app.inject({ method: "GET", url: `/v1/families/${familyId}/categories`, headers: t.as(tokens) });
  return res.json<{ id: string }[]>()[0]!.id;
}

const MONTH = "2026-03";
const template = (over: Record<string, unknown> = {}) => ({
  name: "House rent",
  amountPaisa: 1_200_000,
  dayOfMonth: 5,
  startsOn: "2026-01-01",
  ...over,
});

describe("recurring routes (db)", () => {
  it("confirm creates exactly one transaction for the month", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const created = await t.app.inject({
        method: "POST",
        url: `/v1/families/${familyId}/recurring`,
        headers: t.as(owner),
        payload: template({ categoryId: await firstCategory(t, owner, familyId) }),
      });
      expect(created.statusCode).toBe(201);
      const id = created.json<{ id: string }>().id;

      const url = `/v1/families/${familyId}/recurring/${id}/confirm?month=${MONTH}`;
      const [a, b] = await Promise.all([
        t.app.inject({ method: "POST", url, headers: t.as(owner), payload: {} }),
        t.app.inject({ method: "POST", url, headers: t.as(owner), payload: {} }),
      ]);
      expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);

      const rows = await sql<{ amount_paisa: string; note: string; occurred_at: Date }[]>`
        select amount_paisa, note, occurred_at from ledger.transactions where family_id = ${familyId}`;
      expect(rows).toHaveLength(1);
      expect(Number(rows[0]!.amount_paisa)).toBe(1_200_000);
      expect(rows[0]!.note).toBe("House rent");
      const [tpl] = await sql<{ last_confirmed_month: string }[]>`
        select last_confirmed_month from recurring.recurring_templates where id = ${id}`;
      expect(tpl!.last_confirmed_month).toBe(MONTH);
      await t.close();
    });
  });

  it("second confirm is rejected", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const created = await t.app.inject({
        method: "POST",
        url: `/v1/families/${familyId}/recurring`,
        headers: t.as(owner),
        payload: template(),
      });
      const id = created.json<{ id: string }>().id;
      const url = `/v1/families/${familyId}/recurring/${id}/confirm?month=${MONTH}`;
      expect((await t.app.inject({ method: "POST", url, headers: t.as(owner), payload: {} })).statusCode).toBe(201);
      const second = await t.app.inject({ method: "POST", url, headers: t.as(owner), payload: {} });
      expect(second.statusCode).toBe(409);
      expect(second.json<{ error: { code: string } }>().error.code).toBe("not_due");
      const drafts = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/recurring/drafts?month=${MONTH}`,
        headers: t.as(owner),
      });
      expect(drafts.json<{ drafts: unknown[] }>().drafts).toHaveLength(0);
      await t.close();
    });
  });

  it("template with foreign category is rejected", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const other = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      const otherFamily = await createFamily(t, other);
      const foreign = await firstCategory(t, other, otherFamily);
      const res = await t.app.inject({
        method: "POST",
        url: `/v1/families/${familyId}/recurring`,
        headers: t.as(owner),
        payload: template({ categoryId: foreign }),
      });
      expect(res.statusCode).toBe(400);
      expect(res.json<{ error: { code: string } }>().error.code).toBe("invalid_category");
      await t.close();
    });
  });
});
