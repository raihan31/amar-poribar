import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import { createFakeClaude } from "./infra/fake-claude.js";

const SMS =
  "You have received Tk 5,000.00 from 01712345678. Fee Tk 0.00. Balance Tk 7,500.00. TrxID 9A1B2C3D4E at 14/01/2026 10:30";

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

const post = (t: TestApp, who: Tokens, url: string, payload: unknown) =>
  t.app.inject({ method: "POST", url, headers: t.as(who), payload: payload as object });

describe("ai routes (db)", () => {
  it("parse of a bKash SMS never calls the Claude fake", async () => {
    await withTestDb(async ({ db, sql }) => {
      const fake = createFakeClaude();
      const t = await buildTestApp({ db, sql, anthropic: fake.client });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const res = await post(t, owner, `/v1/families/${familyId}/ai/parse`, { text: SMS });
      expect(res.statusCode).toBe(200);
      expect(res.json().usedAi).toBe(false);
      expect(res.json().drafts).toHaveLength(1);
      expect(fake.calls.count).toBe(0);
      await t.close();
    });
  });

  it('parse of "bazar 850 cash" uses the quick parser without AI', async () => {
    await withTestDb(async ({ db, sql }) => {
      const fake = createFakeClaude();
      const t = await buildTestApp({ db, sql, anthropic: fake.client });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const res = await post(t, owner, `/v1/families/${familyId}/ai/parse`, { text: "bazar 850 cash" });
      expect(res.statusCode).toBe(200);
      expect(res.json().usedAi).toBe(false);
      expect(res.json().drafts[0].amountPaisa).toBe(85_000);
      expect(fake.calls.count).toBe(0);
      await t.close();
    });
  });

  it("summary cache returns the same text and makes no second AI call", async () => {
    await withTestDb(async ({ db, sql }) => {
      const fake = createFakeClaude([
        { fingerprint: "Placeholders:", output: { summary: "এই মাসে মোট {TOTAL} খরচ হয়েছে।" } },
      ]);
      const t = await buildTestApp({ db, sql, anthropic: fake.client });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const created = await post(t, owner, `/v1/families/${familyId}/transactions`, {
        type: "expense",
        amountPaisa: 50_000,
        occurredAt: "2026-01-10T06:00:00.000Z",
      });
      expect(created.statusCode).toBe(201);
      const url = `/v1/families/${familyId}/ai/summary?month=2026-01&locale=bn`;
      const first = await t.app.inject({ method: "GET", url, headers: t.as(owner) });
      const second = await t.app.inject({ method: "GET", url, headers: t.as(owner) });
      expect(first.statusCode).toBe(200);
      expect(first.json().usedAi).toBe(true);
      expect(second.json().text).toBe(first.json().text);
      expect(fake.calls.count).toBe(1);
      await t.close();
    });
  });

  it("viewer can read summary but not parse", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const viewer = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      await join(t, owner, familyId, viewer, "viewer");
      const summary = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/ai/summary?month=2026-01&locale=en`,
        headers: t.as(viewer),
      });
      expect(summary.statusCode).toBe(200);
      const parse = await post(t, viewer, `/v1/families/${familyId}/ai/parse`, { text: "bazar 850 cash" });
      expect(parse.statusCode).toBe(403);
      await t.close();
    });
  });

  it("ask rejects viewers", async () => {
    await withTestDb(async ({ db, sql }) => {
      const fake = createFakeClaude();
      const t = await buildTestApp({ db, sql, anthropic: fake.client });
      const owner = await t.login("01711111111");
      const viewer = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      await join(t, owner, familyId, viewer, "viewer");
      const res = await post(t, viewer, `/v1/families/${familyId}/ai/ask`, { question: "How much on groceries?" });
      expect(res.statusCode).toBe(403);
      expect(fake.calls.count).toBe(0);
      await t.close();
    });
  });

  it("receipt without client returns 503 ai_unavailable", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const res = await post(t, owner, `/v1/families/${familyId}/ai/receipt`, {
        imageBase64: "A".repeat(200),
        mediaType: "image/jpeg",
      });
      expect(res.statusCode).toBe(503);
      expect(res.json().error.code).toBe("ai_unavailable");
      await t.close();
    });
  });

  it("parse with another family's id is 404", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const stranger = await t.login("01733333333");
      const familyId = await createFamily(t, owner);
      const res = await post(t, stranger, `/v1/families/${familyId}/ai/parse`, { text: "bazar 850 cash" });
      expect(res.statusCode).toBe(404);
      await t.close();
    });
  });
});
