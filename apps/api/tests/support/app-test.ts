import { buildApp } from "../../src/app.js";
import type { Db, Sql } from "../../src/platform/db.js";
import { createJobs } from "../../src/platform/jobs/jobs.js";
import { LocalFanout } from "../../src/platform/realtime/fanout.js";
import { testConfig } from "./config.js";
import { MemoryPush } from "../../src/platform/ports/fakes/memory-push.js";
import { MemorySms } from "../../src/platform/ports/fakes/memory-sms.js";
import {
  DbLimiter,
  MemoryLimiter,
  type HitManyResult,
  type HitResult,
  type Limiter,
} from "../../src/platform/rate-limit/limiter.js";
import type { RateRule } from "../../src/platform/rate-limit/limits.js";

export const FIXED_NOW = new Date("2026-01-15T06:00:00.000Z");

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * In-memory limiter whose clock jumps 13 minutes for every OTP request, so helpers such as `login` can sign the
 * same number in repeatedly without meeting the 60 second gap or the hourly cap (never more than 5 per hour).
 * Tests of the OTP limits themselves pass `realOtpLimits`.
 */
class SteppingLimiter implements Limiter {
  private offsetMs = 0;
  private readonly inner = new MemoryLimiter(() => Date.now() + this.offsetMs);

  hit(key: string, rule: RateRule): Promise<HitResult> {
    if (key.startsWith("otp:hour:")) this.offsetMs += 13 * 60_000;
    return this.inner.hit(key, rule);
  }

  hitMany(key: string, rules: readonly RateRule[]): Promise<HitManyResult> {
    return this.inner.hitMany(key, rules);
  }
}

export interface BuildTestAppOptions {
  db: Db;
  sql: Sql;
  /** Use the PostgreSQL-backed limiter instead of the in-memory one. */
  dbLimiter?: boolean;
  /** Keep the real OTP windows (the default limiter skips ahead between OTP requests; see `SteppingLimiter`). */
  realOtpLimits?: boolean;
  clock?: () => Date;
}

/** The full app wired with fakes: memory SMS/push, memory limiter, fixed clock. */
export async function buildTestApp(opts: BuildTestAppOptions) {
  const fakes = {
    sms: new MemorySms(),
    push: new MemoryPush(),
    limiter: (opts.dbLimiter
      ? new DbLimiter(opts.sql)
      : opts.realOtpLimits
        ? new MemoryLimiter()
        : new SteppingLimiter()) as Limiter,
    clock: opts.clock ?? (() => FIXED_NOW),
  };
  const app = await buildApp({
    config: testConfig(),
    db: opts.db,
    deps: {
      sql: opts.sql,
      ports: { sms: fakes.sms, push: fakes.push },
      limiter: fakes.limiter,
      jobs: createJobs({ inline: true }),
      fanout: new LocalFanout(),
      clock: fakes.clock,
    },
  });
  await app.ready();

  /** OTP flow: request a code (read from the dev response or the fake SMS) and verify it. */
  async function login(phone: string): Promise<Tokens> {
    const req = await app.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone } });
    if (req.statusCode !== 200) throw new Error(`otp request failed: ${req.statusCode} ${req.body}`);
    const code = req.json<{ devCode?: string }>().devCode ?? /\d{6}/.exec(fakes.sms.last()?.text ?? "")?.[0];
    if (!code) throw new Error("no OTP code available");
    const res = await app.inject({ method: "POST", url: "/v1/auth/otp/verify", payload: { phone, code } });
    if (res.statusCode !== 200) throw new Error(`otp verify failed: ${res.statusCode} ${res.body}`);
    return res.json<Tokens>();
  }

  /** Authorization headers for a logged-in user. */
  const as = (user: Tokens) => ({ authorization: `Bearer ${user.accessToken}` });

  return { app, db: opts.db, fakes, login, as, close: () => app.close() };
}

export type TestApp = Awaited<ReturnType<typeof buildTestApp>>;
