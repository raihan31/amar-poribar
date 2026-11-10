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

async function post(t: TestApp, tokens: Tokens, familyId: string, payload: Record<string, unknown>) {
  const res = await t.app.inject({
    method: "POST",
    url: `/v1/families/${familyId}/transactions`,
    headers: t.as(tokens),
    payload,
  });
  expect(res.statusCode).toBe(201);
}

describe("reporting routes (db)", () => {
  it("summary excludes other members private rows", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const member = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      await join(t, owner, familyId, member, "member");
      await post(t, owner, familyId, { type: "expense", amountPaisa: 10_000, occurredAt: "2026-01-10T06:00:00.000Z" });
      await post(t, owner, familyId, {
        type: "expense",
        amountPaisa: 70_000,
        occurredAt: "2026-01-11T06:00:00.000Z",
        isPrivate: true,
      });
      const mine = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/reports/summary?month=2026-01`,
        headers: t.as(owner),
      });
      expect(mine.json<{ expensePaisa: number }>().expensePaisa).toBe(80_000);
      const theirs = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/reports/summary?month=2026-01`,
        headers: t.as(member),
      });
      expect(theirs.statusCode).toBe(200);
      const body = theirs.json<{ expensePaisa: number; previous: { month: string } }>();
      expect(body.expensePaisa).toBe(10_000);
      expect(body.previous.month).toBe("2025-12");
      await t.close();
    });
  });

  it("remittance window defaults to six months", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const viewer = await t.login("01733333333");
      const familyId = await createFamily(t, owner);
      await join(t, owner, familyId, viewer, "viewer");
      const res = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/reports/remittances?to=2026-06`,
        headers: t.as(viewer),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ from: string; to: string; months: { month: string }[] }>();
      expect(body.from).toBe("2026-01");
      expect(body.to).toBe("2026-06");
      expect(body.months).toHaveLength(6);
      await t.close();
    });
  });

  it("range over 24 months returns 400", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const rem = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/reports/remittances?from=2024-01&to=2026-06`,
        headers: t.as(owner),
      });
      expect(rem.statusCode).toBe(400);
      const csv = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/reports/export.csv?from=2024-01&to=2026-06`,
        headers: t.as(owner),
      });
      expect(csv.statusCode).toBe(400);
      await t.close();
    });
  });

  it("csv export matches fixture", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const viewer = await t.login("01733333333");
      const familyId = await createFamily(t, owner);
      await join(t, owner, familyId, viewer, "viewer");
      await post(t, owner, familyId, {
        type: "expense",
        amountPaisa: 12_345,
        feePaisa: 5,
        occurredAt: "2026-01-10T06:00:00.000Z",
        counterparty: "Shwapno",
        trxId: "TX1",
        note: 'chal, "dal"',
      });
      const res = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/reports/export.csv?month=2026-01`,
        headers: t.as(owner),
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("text/csv; charset=utf-8");
      expect(res.headers["content-disposition"]).toBe('attachment; filename="amar-poribar-2026-01.csv"');
      expect(res.body).toBe(
        "﻿Date,Type,Amount (BDT),Fee (BDT),Category,Category (বাংলা),Account,Counterparty,TrxID,Note\r\n" +
          '2026-01-10 12:00,expense,123.45,0.05,,,,Shwapno,TX1,"chal, ""dal"""\r\n',
      );
      const denied = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/reports/export.csv?month=2026-01`,
        headers: t.as(viewer),
      });
      expect(denied.statusCode).toBe(403);
      await t.close();
    });
  });
});
