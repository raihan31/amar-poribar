import { describe, expect, it } from "vitest";
import { buildTestApp } from "../../../tests/support/app-test.js";
import { testConfig } from "../../../tests/support/config.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import { buildApp } from "../../app.js";
import { createJobs } from "../../platform/jobs/jobs.js";
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
        deps: { sql, limiter: new MemoryLimiter(), jobs: createJobs({ inline: true }) },
      });
      const res = await prod.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone: "01712345678" } });
      expect(res.json()).toEqual({ sent: true });
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
});
