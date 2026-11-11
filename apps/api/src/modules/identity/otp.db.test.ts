import { describe, expect, it } from "vitest";
import { buildTestApp } from "../../../tests/support/app-test.js";
import { withTestDb, type TestDb } from "../../../tests/support/db-test.js";
import { createJobs } from "../../platform/jobs/jobs.js";
import { MemoryLimiter } from "../../platform/rate-limit/limiter.js";
import { createOtpRepo } from "./infra/otp-repo.js";
import { createOtpService } from "./app/otp-service.js";
import { purgeOtp, purgeOtpJob } from "./jobs.js";
import { OTP_TTL_SEC, compareCodeHash } from "./domain/otp.js";

const PHONE = "+8801712345678";
const PEPPER = "x".repeat(40);
const START = new Date("2026-01-15T06:00:00.000Z");

function setup(t: TestDb) {
  let now = START.getTime();
  const clock = () => new Date(now);
  const advance = (sec: number) => (now += sec * 1000);
  const service = createOtpService({
    repo: createOtpRepo(t.db),
    limiter: new MemoryLimiter(() => now),
    clock,
    pepper: PEPPER,
  });
  return { service, advance, clock };
}

const wrongOf = (code: string) => (code === "000000" ? "111111" : "000000");

describe("otp service (db)", () => {
  it("issues a 6 digit code and stores only hashes", async () => {
    await withTestDb(async (t) => {
      const { service } = setup(t);
      const { code, expiresAt } = await service.issue(PHONE, "1.2.3.4");
      expect(code).toMatch(/^\d{6}$/);
      expect(expiresAt.getTime()).toBe(START.getTime() + OTP_TTL_SEC * 1000);
      const rows = await t.sql`select * from identity.otp_challenges`;
      expect(rows).toHaveLength(1);
      const dump = JSON.stringify(rows[0]);
      expect(dump).not.toContain(code);
      expect(dump).not.toContain(PHONE);
      expect(rows[0]!.phone_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(rows[0]!.code_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(rows[0]!.ip).toBe("1.2.3.4");
    });
  });

  it("rejects a second request inside 60 seconds with retryAfterSeconds", async () => {
    await withTestDb(async (t) => {
      const { service, advance } = setup(t);
      await service.issue(PHONE, "1.2.3.4");
      advance(10);
      await expect(service.issue(PHONE, "1.2.3.4")).rejects.toMatchObject({
        status: 429,
        code: "otp_rate_limited",
        details: { retryAfterSeconds: expect.any(Number) },
      });
      advance(61);
      await expect(service.issue(PHONE, "1.2.3.4")).resolves.toBeTruthy();
    });
  });

  it("rejects the sixth request in an hour", async () => {
    await withTestDb(async (t) => {
      const { service, advance } = setup(t);
      for (let i = 0; i < 5; i++) {
        await service.issue(PHONE, "1.2.3.4");
        advance(61);
      }
      await expect(service.issue(PHONE, "1.2.3.4")).rejects.toMatchObject({
        status: 429,
        code: "otp_rate_limited",
        details: { retryAfterSeconds: expect.any(Number) },
      });
    });
  });

  it("rejects the 21st in a day", async () => {
    await withTestDb(async (t) => {
      const { service, advance } = setup(t);
      for (let i = 0; i < 20; i++) {
        await service.issue(PHONE, "1.2.3.4");
        advance(12 * 60);
      }
      await expect(service.issue(PHONE, "1.2.3.4")).rejects.toMatchObject({ status: 429, code: "otp_rate_limited" });
    });
  });

  it("limits requests per IP across numbers", async () => {
    await withTestDb(async (t) => {
      const { service } = setup(t);
      for (let i = 0; i < 30; i++) await service.issue(`+88017000${String(i).padStart(5, "0")}`, "9.9.9.9");
      await expect(service.issue("+8801799999999", "9.9.9.9")).rejects.toMatchObject({ code: "otp_rate_limited" });
    });
  });

  it("wrong code decrements attemptsLeft", async () => {
    await withTestDb(async (t) => {
      const { service } = setup(t);
      const { code } = await service.issue(PHONE, "1.2.3.4");
      await expect(service.verify(PHONE, wrongOf(code))).rejects.toMatchObject({
        status: 401,
        code: "otp_invalid",
        details: { attemptsLeft: 4 },
      });
      await expect(service.verify(PHONE, wrongOf(code))).rejects.toMatchObject({ details: { attemptsLeft: 3 } });
      await expect(service.verify(PHONE, code)).resolves.toBe(true);
    });
  });

  it("sixth wrong try returns attemptsLeft 0 even with the right code", async () => {
    await withTestDb(async (t) => {
      const { service } = setup(t);
      const { code } = await service.issue(PHONE, "1.2.3.4");
      for (let i = 0; i < 5; i++) {
        await expect(service.verify(PHONE, wrongOf(code))).rejects.toMatchObject({ code: "otp_invalid" });
      }
      await expect(service.verify(PHONE, code)).rejects.toMatchObject({
        status: 401,
        code: "otp_invalid",
        details: { attemptsLeft: 0 },
      });
    });
  });

  it("expired code returns otp_expired", async () => {
    await withTestDb(async (t) => {
      const { service, advance } = setup(t);
      const { code } = await service.issue(PHONE, "1.2.3.4");
      advance(OTP_TTL_SEC + 1);
      await expect(service.verify(PHONE, code)).rejects.toMatchObject({ status: 401, code: "otp_expired" });
      await expect(service.verify("+8801999999999", "123456")).rejects.toMatchObject({ code: "otp_expired" });
    });
  });

  it("new code invalidates the old one", async () => {
    await withTestDb(async (t) => {
      const { service, advance } = setup(t);
      const first = await service.issue(PHONE, "1.2.3.4");
      advance(61);
      const second = await service.issue(PHONE, "1.2.3.4");
      if (first.code !== second.code) {
        await expect(service.verify(PHONE, first.code)).rejects.toMatchObject({ code: "otp_invalid" });
      }
      await expect(service.verify(PHONE, second.code)).resolves.toBe(true);
      const open = await t.sql`select 1 from identity.otp_challenges where consumed_at is null`;
      expect(open).toHaveLength(0);
    });
  });

  it("consumed code cannot be reused", async () => {
    await withTestDb(async (t) => {
      const { service } = setup(t);
      const { code } = await service.issue(PHONE, "1.2.3.4");
      await expect(service.verify(PHONE, code)).resolves.toBe(true);
      await expect(service.verify(PHONE, code)).rejects.toMatchObject({ status: 401, code: "otp_expired" });
    });
  });

  it("purge job deletes rows older than 24h", async () => {
    await withTestDb(async (t) => {
      const { service, advance, clock } = setup(t);
      await service.issue(PHONE, "1.2.3.4");
      advance(25 * 3600);
      await service.issue(PHONE, "1.2.3.4");
      await purgeOtp(t.db, clock());
      expect(await t.sql`select 1 from identity.otp_challenges`).toHaveLength(1);

      const jobs = createJobs({ inline: true });
      const def = purgeOtpJob({ db: t.db, clock: () => new Date(clock().getTime() + 25 * 3600_000) });
      expect(def.name).toBe("identity.purge-otp");
      expect(def.cron).toBe("10 3 * * *");
      jobs.register(def);
      await jobs.send("identity.purge-otp", {});
      expect(await t.sql`select 1 from identity.otp_challenges`).toHaveLength(0);
    });
  });

  it("limits survive an app restart", async () => {
    await withTestDb(async (t) => {
      const request = (app: Awaited<ReturnType<typeof buildTestApp>>["app"]) =>
        app.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone: "01712345678" } });
      const first = await buildTestApp({ db: t.db, sql: t.sql, dbLimiter: true });
      const ok = await request(first.app);
      expect(ok.statusCode).toBe(200);
      await first.close();
      const second = await buildTestApp({ db: t.db, sql: t.sql, dbLimiter: true });
      const res = await request(second.app);
      expect(res.statusCode).toBe(429);
      expect(res.json().error).toMatchObject({
        code: "otp_rate_limited",
        details: { retryAfterSeconds: expect.any(Number) },
      });
      // the code issued before the restart still verifies
      const code = ok.json<{ devCode: string }>().devCode;
      const v = await second.app.inject({
        method: "POST",
        url: "/v1/auth/otp/verify",
        payload: { phone: "01712345678", code },
      });
      expect(v.statusCode).toBe(200);
      await second.close();
    });
  });

  it("compareCodeHash is constant time and length safe", () => {
    expect(compareCodeHash("ab", "ab")).toBe(true);
    expect(compareCodeHash("ab", "abc")).toBe(false);
    expect(compareCodeHash("ab", "ac")).toBe(false);
  });
});
