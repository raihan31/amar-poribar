import { describe, expect, it } from "vitest";
import { buildTestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import { POLICY_VERSION } from "./index.js";

type T = Awaited<ReturnType<typeof buildTestApp>>;
const accept = (t: T, tokens: Tokens, payload: object) =>
  t.app.inject({ method: "POST", url: "/v1/me/consents", headers: t.as(tokens), payload });
const state = (t: T, tokens: Tokens) => t.app.inject({ method: "GET", url: "/v1/me/consents", headers: t.as(tokens) });

describe("consent records (db)", () => {
  it("accepting the same version twice returns one row", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      const body = { kind: "privacy_policy", version: POLICY_VERSION, locale: "bn" };
      expect((await accept(t, u, body)).statusCode).toBe(201);
      expect((await accept(t, u, body)).statusCode).toBe(201);
      const rows = await sql`select kind, version, locale from identity.consents`;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: "privacy_policy", version: POLICY_VERSION, locale: "bn" });
      await t.close();
    });
  });

  it("outdated version is rejected", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      const res = await accept(t, u, { kind: "privacy_policy", version: "2020-01-01", locale: "en" });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toMatchObject({
        code: "policy_version_outdated",
        details: { currentVersion: POLICY_VERSION },
      });
      expect(await sql`select 1 from identity.consents`).toHaveLength(0);
      expect((await accept(t, u, { kind: "x", version: POLICY_VERSION, locale: "en" })).statusCode).toBe(400);
      await t.close();
    });
  });

  it("needsAcceptance true after POLICY_VERSION changes", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      expect((await state(t, u)).json()).toEqual({
        privacyPolicy: { acceptedVersion: null, current: POLICY_VERSION, needsAcceptance: true },
        voiceNotes: { accepted: false },
      });
      await accept(t, u, { kind: "privacy_policy", version: POLICY_VERSION, locale: "bn" });
      await accept(t, u, { kind: "voice_notes", version: POLICY_VERSION, locale: "bn" });
      expect((await state(t, u)).json()).toEqual({
        privacyPolicy: { acceptedVersion: POLICY_VERSION, current: POLICY_VERSION, needsAcceptance: false },
        voiceNotes: { accepted: true },
      });
      // A newer policy ships: the stored acceptance is for an older version.
      await sql`update identity.consents set version = '2026-01-01' where kind = 'privacy_policy'`;
      const after = (await state(t, u)).json();
      expect(after.privacyPolicy).toEqual({
        acceptedVersion: "2026-01-01",
        current: POLICY_VERSION,
        needsAcceptance: true,
      });
      const me = await t.app.inject({ method: "GET", url: "/v1/me", headers: t.as(u) });
      expect(me.json().consents.needsAcceptance).toBe(true);
      expect((await t.app.inject({ method: "GET", url: "/v1/me/consents" })).statusCode).toBe(401);
      await t.close();
    });
  });

  it("policy endpoint serves bn and en", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      for (const locale of ["bn", "en"] as const) {
        const res = await t.app.inject({ method: "GET", url: `/v1/policy?locale=${locale}` });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ version: POLICY_VERSION, locale });
        expect(res.json().text.length).toBeGreaterThan(100);
      }
      await t.close();
    });
  });

  it("policy mentions cross border AI and 180 days", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const get = async (locale: string) =>
        (await t.app.inject({ method: "GET", url: `/v1/policy?locale=${locale}` })).json().text as string;
      const en = await get("en");
      expect(en).toMatch(/outside Bangladesh/i);
      expect(en).toMatch(/180 days/);
      const bn = await get("bn");
      expect(bn).toMatch(/বাংলাদেশের বাইরে/);
      expect(bn).toMatch(/১৮০|180/);
      await t.close();
    });
  });
});
