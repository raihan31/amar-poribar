import { describe, expect, it } from "vitest";
import { buildTestApp } from "../../../tests/support/app-test.js";
import { testConfig } from "../../../tests/support/config.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import { buildApp } from "../../app.js";
import { createJobs } from "../../platform/jobs/jobs.js";
import { MemorySms } from "../../platform/ports/fakes/memory-sms.js";
import { MemoryLimiter } from "../../platform/rate-limit/limiter.js";

describe("identity auth (db)", () => {
  it("verify creates the user once and issues tokens", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const first = await t.login("01712345678");
      const second = await t.login("01712345678");
      expect(first.accessToken).toBeTruthy();
      const rows = await sql`select id from identity.users where phone = '+8801712345678'`;
      expect(rows.length).toBe(1);
      const refreshed = await t.app.inject({
        method: "POST",
        url: "/v1/auth/refresh",
        payload: { refreshToken: second.refreshToken },
      });
      expect(refreshed.statusCode).toBe(200);
      await t.close();
    });
  });

  it("issues a dev OTP outside production", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const res = await t.app.inject({
        method: "POST",
        url: "/v1/auth/otp/request",
        payload: { phone: "01712345678" },
      });
      expect(res.json().devCode).toMatch(/^\d{6}$/);
      await t.close();
    });
  });

  it("does not return the OTP in production", async () => {
    await withTestDb(async ({ db, sql }) => {
      const prod = await buildApp({
        config: testConfig({ NODE_ENV: "production" }),
        db,
        deps: {
          sql,
          limiter: new MemoryLimiter(),
          jobs: createJobs({ inline: true }),
          ports: { sms: new MemorySms() },
        },
      });
      const res = await prod.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone: "01712345678" } });
      expect(res.json()).toEqual({ sent: true, resendInSeconds: 60 });
      await prod.close();
    });
  });

  it("an unknown number gets otp_expired and a wrong code gets otp_invalid", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const verify = (phone: string, code: string) =>
        t.app.inject({ method: "POST", url: "/v1/auth/otp/verify", payload: { phone, code } });
      const unknown = await verify("01999999999", "123456");
      expect(unknown.statusCode).toBe(401);
      expect(unknown.json().error.code).toBe("otp_expired");
      const req = await t.app.inject({
        method: "POST",
        url: "/v1/auth/otp/request",
        payload: { phone: "01712345678" },
      });
      const code = req.json<{ devCode: string }>().devCode;
      const bad = await verify("01712345678", code === "000000" ? "111111" : "000000");
      expect(bad.statusCode).toBe(401);
      expect(bad.json().error).toMatchObject({ code: "otp_invalid", details: { attemptsLeft: 4 } });
      await t.close();
    });
  });

  it("request sends one SMS to the fake gateway", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const res = await t.app.inject({
        method: "POST",
        url: "/v1/auth/otp/request",
        payload: { phone: "01712345678" },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ sent: boolean; resendInSeconds: number; devCode: string }>();
      expect(body).toMatchObject({ sent: true, resendInSeconds: 60 });
      expect(t.fakes.sms.sent).toHaveLength(1);
      expect(t.fakes.sms.last()).toMatchObject({ to: "+8801712345678", kind: "otp" });
      expect(t.fakes.sms.last()!.text).toContain(body.devCode);
      await t.close();
    });
  });

  it("verify creates a user and returns tokens", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const res = await verifyFresh(t, "01712345678");
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        isNewUser: true,
        user: { name: null, locale: "bn", numeralStyle: "bn", simpleMode: false },
      });
      expect(res.json().user).not.toHaveProperty("phone");
      expect(res.json()).not.toHaveProperty("erasurePending");
      await t.close();
    });
  });

  it("verify with wrong code returns otp_invalid and attemptsLeft", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const req = await t.app.inject({
        method: "POST",
        url: "/v1/auth/otp/request",
        payload: { phone: "01712345678" },
      });
      const code = req.json<{ devCode: string }>().devCode;
      const bad = await t.app.inject({
        method: "POST",
        url: "/v1/auth/otp/verify",
        payload: { phone: "01712345678", code: code === "000000" ? "111111" : "000000" },
      });
      expect(bad.statusCode).toBe(401);
      expect(bad.json().error).toMatchObject({ code: "otp_invalid", details: { attemptsLeft: 4 } });
      await t.close();
    });
  });

  it("sixth code request in an hour returns otp_rate_limited", async () => {
    await withTestDb(async ({ db, sql }) => {
      let now = Date.parse("2026-01-15T06:00:00Z");
      const app = await buildApp({
        config: testConfig(),
        db,
        deps: {
          sql,
          limiter: new MemoryLimiter(() => now),
          jobs: createJobs({ inline: true }),
          ports: { sms: new MemorySms() },
        },
      });
      const request = () =>
        app.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone: "01712345678" } });
      for (let i = 0; i < 5; i++) {
        expect((await request()).statusCode).toBe(200);
        now += 61_000;
      }
      const sixth = await request();
      expect(sixth.statusCode).toBe(429);
      expect(sixth.json().error.code).toBe("otp_rate_limited");
      await app.close();
    });
  });

  it("isNewUser true only on first sign in", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      expect((await verifyFresh(t, "01712345678")).json().isNewUser).toBe(true);
      expect((await verifyFresh(t, "01712345678")).json().isNewUser).toBe(false);
      await t.close();
    });
  });

  it("erased user gets account_erased", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      await verifyFresh(t, "01712345678");
      await sql`update identity.users set erased_at = now()`;
      const res = await verifyFresh(t, "01712345678");
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe("account_erased");
      await t.close();
    });
  });

  it("a user with a pending erasure signs in and is told so", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      await verifyFresh(t, "01712345678");
      await sql`update identity.users set erasure_requested_at = now()`;
      const res = await verifyFresh(t, "01712345678");
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ isNewUser: false, erasurePending: true });
      await t.close();
    });
  });

  it("devCode absent when production flag is set", async () => {
    await withTestDb(async ({ db, sql }) => {
      const sms = new MemorySms();
      const prod = await buildApp({
        config: testConfig({ NODE_ENV: "production" }),
        db,
        deps: { sql, limiter: new MemoryLimiter(), jobs: createJobs({ inline: true }), ports: { sms } },
      });
      const res = await prod.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone: "01712345678" } });
      expect(res.json()).toEqual({ sent: true, resendInSeconds: 60 });
      expect(sms.sent).toHaveLength(1);
      await prod.close();
    });
  });
});

type T = Awaited<ReturnType<typeof buildTestApp>>;

/** Requests a fresh code and verifies it; returns the verify response. */
async function verifyFresh(t: T, phone: string) {
  const req = await t.app.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone } });
  const code = req.json<{ devCode: string }>().devCode;
  return t.app.inject({ method: "POST", url: "/v1/auth/otp/verify", payload: { phone, code } });
}
