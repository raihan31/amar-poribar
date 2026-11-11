import { describe, expect, it } from "vitest";
import { buildTestApp, type Tokens } from "../../../../tests/support/app-test.js";
import { withTestDb } from "../../../../tests/support/db-test.js";

type T = Awaited<ReturnType<typeof buildTestApp>>;
const patch = (t: T, tokens: Tokens, payload: object) =>
  t.app.inject({ method: "PATCH", url: "/v1/me", headers: t.as(tokens), payload });

describe("PATCH /v1/me (db)", () => {
  it("patch name trims whitespace", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      const res = await patch(t, u, { name: "  রহিম  " });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.name).toBe("রহিম");
      expect(body.phone).toBe("+8801712345678");
      expect(body.locale).toBe("bn");
      expect(body.createdAt).toBeTruthy();
      await t.close();
    });
  });

  it("patch numeralStyle latin stores bn_digits false", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      const res = await patch(t, u, { numeralStyle: "latin" });
      expect(res.statusCode).toBe(200);
      expect(res.json().numeralStyle).toBe("latin");
      const rows = await sql`select bn_digits from identity.users where phone = '+8801712345678'`;
      expect(rows[0]!.bn_digits).toBe(false);
      const back = await patch(t, u, { numeralStyle: "bn" });
      expect(back.json().numeralStyle).toBe("bn");
      await t.close();
    });
  });

  it("empty body is rejected", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      const res = await patch(t, u, {});
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("invalid_request");
      const bad = await patch(t, u, { locale: "fr" });
      expect(bad.statusCode).toBe(400);
      expect(bad.json().error.code).toBe("invalid_request");
      await t.close();
    });
  });

  it("simpleMode round trips", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      expect((await patch(t, u, { simpleMode: true })).json().simpleMode).toBe(true);
      expect((await patch(t, u, { simpleMode: false, locale: "en" })).json()).toMatchObject({
        simpleMode: false,
        locale: "en",
      });
      await t.close();
    });
  });

  it("another user's profile is untouched", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const a = await t.login("01712345678");
      await t.login("01812345678");
      await patch(t, a, { name: "A", simpleMode: true, numeralStyle: "latin" });
      const rows = await sql`select name, simple_mode, bn_digits from identity.users where phone = '+8801812345678'`;
      expect(rows[0]).toMatchObject({ name: null, simple_mode: false, bn_digits: true });
      await t.close();
    });
  });

  it("requires auth", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const res = await t.app.inject({ method: "PATCH", url: "/v1/me", payload: { name: "x" } });
      expect(res.statusCode).toBe(401);
      await t.close();
    });
  });
});
