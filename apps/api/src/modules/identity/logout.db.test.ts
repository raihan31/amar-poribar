import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";

const logout = (t: TestApp, tokens: Tokens, payload: object = {}) =>
  t.app.inject({ method: "POST", url: "/v1/auth/logout", headers: t.as(tokens), payload });
const me = (t: TestApp, tokens: Tokens) =>
  t.app.inject({ method: "PATCH", url: "/v1/me", headers: t.as(tokens), payload: { simpleMode: true } });

describe("logout (db)", () => {
  it("logout revokes the current session only", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const a = await t.login("01712345678");
      const b = await t.login("01712345678");
      const res = await logout(t, a);
      expect(res.statusCode).toBe(204);
      expect((await me(t, a)).statusCode).toBe(401);
      expect((await me(t, b)).statusCode).toBe(200);
      const refresh = await t.app.inject({
        method: "POST",
        url: "/v1/auth/refresh",
        payload: { refreshToken: a.refreshToken },
      });
      expect(refresh.statusCode).toBe(401);
      const rows = await sql`select revoked_reason from identity.sessions where revoked_at is not null`;
      expect(rows.map((r) => r.revoked_reason as string)).toEqual(["logout"]);
      await t.close();
    });
  });

  it("logout-all revokes all sessions", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const a = await t.login("01712345678");
      const b = await t.login("01712345678");
      const other = await t.login("01812345678");
      const res = await t.app.inject({ method: "POST", url: "/v1/auth/logout-all", headers: t.as(a) });
      expect(res.statusCode).toBe(204);
      expect((await me(t, a)).statusCode).toBe(401);
      expect((await me(t, b)).statusCode).toBe(401);
      expect((await me(t, other)).statusCode).toBe(200);
      const rows = await sql`select distinct revoked_reason from identity.sessions where revoked_at is not null`;
      expect(rows.map((r) => r.revoked_reason as string)).toEqual(["logout_all"]);
      await t.close();
    });
  });

  it("revoked access token is refused within 30 seconds", async () => {
    await withTestDb(async ({ db, sql }) => {
      let now = new Date("2026-01-15T06:00:00.000Z");
      const t = await buildTestApp({ db, sql, clock: () => now });
      const a = await t.login("01712345678");
      expect((await me(t, a)).statusCode).toBe(200);
      await logout(t, a);
      now = new Date(now.getTime() + 5_000);
      expect((await me(t, a)).statusCode).toBe(401);
      await t.close();
    });
  });

  it("logout removes the device token", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const a = await t.login("01712345678");
      const [u] = await sql`select id from identity.users limit 1`;
      await sql`insert into identity.devices (user_id, device_id, platform, fcm_token) values (${u!.id}, 'dev-1', 'android', 'tok-1'), (${u!.id}, 'dev-2', 'android', 'tok-2')`;
      const res = await logout(t, a, { deviceId: "dev-1" });
      expect(res.statusCode).toBe(204);
      const rows = await sql`select device_id from identity.devices`;
      expect(rows.map((r) => r.device_id as string)).toEqual(["dev-2"]);
      await t.close();
    });
  });

  it("logout requires authentication", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      expect((await t.app.inject({ method: "POST", url: "/v1/auth/logout", payload: {} })).statusCode).toBe(401);
      expect((await t.app.inject({ method: "POST", url: "/v1/auth/logout-all" })).statusCode).toBe(401);
      await t.close();
    });
  });
});
