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

async function join(t: TestApp, owner: Tokens, familyId: string, who: Tokens, role: string) {
  const invite = await t.app.inject({
    method: "POST",
    url: `/v1/families/${familyId}/invites`,
    headers: t.as(owner),
    payload: { role },
  });
  const res = await t.app.inject({
    method: "POST",
    url: `/v1/invites/${invite.json<{ token: string }>().token}/accept`,
    headers: t.as(who),
  });
  expect(res.statusCode).toBe(200);
}

type BudgetBody = {
  budgets: { categoryId: string | null; limitPaisa: number; spentPaisa: number; level: string; inherited: boolean }[];
};

describe("budgeting routes (db)", () => {
  it("put then get budgets", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const cats = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/categories`,
        headers: t.as(owner),
      });
      const food = cats.json<{ id: string; kind: string }[]>().find((c) => c.kind === "expense")!;
      await t.app.inject({
        method: "POST",
        url: `/v1/families/${familyId}/transactions`,
        headers: t.as(owner),
        payload: { type: "expense", amountPaisa: 85_000, occurredAt: "2026-01-10T06:00:00.000Z", categoryId: food.id },
      });
      const put = await t.app.inject({
        method: "PUT",
        url: `/v1/families/${familyId}/budgets?month=2026-01`,
        headers: t.as(owner),
        payload: {
          budgets: [
            { categoryId: food.id, limitPaisa: 100_000 },
            { categoryId: null, limitPaisa: 500_000 },
          ],
        },
      });
      expect(put.statusCode).toBe(200);
      expect(put.json()).toEqual({ month: "2026-01", updated: 2 });
      // A second put updates in place.
      await t.app.inject({
        method: "PUT",
        url: `/v1/families/${familyId}/budgets?month=2026-01`,
        headers: t.as(owner),
        payload: { budgets: [{ categoryId: null, limitPaisa: 600_000 }] },
      });
      const feb = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/budgets?month=2026-02`,
        headers: t.as(owner),
      });
      const febBody = feb.json<BudgetBody>();
      expect(febBody.budgets).toHaveLength(2);
      expect(febBody.budgets.find((b) => b.categoryId === food.id)).toMatchObject({
        limitPaisa: 100_000,
        spentPaisa: 0,
        level: "ok",
        inherited: true,
      });
      expect(febBody.budgets.find((b) => b.categoryId === null)?.limitPaisa).toBe(600_000);
      const jan = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/budgets?month=2026-01`,
        headers: t.as(owner),
      });
      expect(jan.json<BudgetBody>().budgets.find((b) => b.categoryId === food.id)).toMatchObject({
        spentPaisa: 85_000,
        level: "warning",
      });
      await t.close();
    });
  });

  it("viewer cannot put budgets", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const viewer = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      await join(t, owner, familyId, viewer, "viewer");
      const res = await t.app.inject({
        method: "PUT",
        url: `/v1/families/${familyId}/budgets?month=2026-01`,
        headers: t.as(viewer),
        payload: { budgets: [{ categoryId: null, limitPaisa: 100_000 }] },
      });
      expect(res.statusCode).toBe(403);
      const read = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/budgets?month=2026-01`,
        headers: t.as(viewer),
      });
      expect(read.statusCode).toBe(200);
      await t.close();
    });
  });

  it("rejects a category from another family", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const res = await t.app.inject({
        method: "PUT",
        url: `/v1/families/${familyId}/budgets?month=2026-01`,
        headers: t.as(owner),
        payload: { budgets: [{ categoryId: "00000000-0000-4000-8000-000000000000", limitPaisa: 100_000 }] },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json<{ error: { code: string } }>().error.code).toBe("invalid_category");
      await t.close();
    });
  });

  it("festival spend counts only the range", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const spend = (amountPaisa: number, occurredAt: string) =>
        t.app.inject({
          method: "POST",
          url: `/v1/families/${familyId}/transactions`,
          headers: t.as(owner),
          payload: { type: "expense", amountPaisa, occurredAt },
        });
      await spend(1_000, "2026-05-19T10:00:00.000Z"); // day before
      await spend(2_000, "2026-05-20T10:00:00.000Z"); // first day
      await spend(4_000, "2026-05-30T10:00:00.000Z"); // last day
      await spend(8_000, "2026-05-31T10:00:00.000Z"); // day after
      const created = await t.app.inject({
        method: "POST",
        url: `/v1/families/${familyId}/festival-budgets`,
        headers: t.as(owner),
        payload: { name: "Eid", startsOn: "2026-05-20", endsOn: "2026-05-30", limitPaisa: 6_000 },
      });
      expect(created.statusCode).toBe(201);
      const list = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/festival-budgets`,
        headers: t.as(owner),
      });
      expect(list.json<{ spentPaisa: number; level: string }[]>()).toMatchObject([
        { spentPaisa: 6_000, level: "exceeded" },
      ]);
      const id = created.json<{ id: string }>().id;
      const bad = await t.app.inject({
        method: "PATCH",
        url: `/v1/families/${familyId}/festival-budgets/${id}`,
        headers: t.as(owner),
        payload: { endsOn: "2026-05-01" },
      });
      expect(bad.statusCode).toBe(400);
      const del = await t.app.inject({
        method: "DELETE",
        url: `/v1/families/${familyId}/festival-budgets/${id}`,
        headers: t.as(owner),
      });
      expect(del.statusCode).toBe(204);
      await t.close();
    });
  });
});
