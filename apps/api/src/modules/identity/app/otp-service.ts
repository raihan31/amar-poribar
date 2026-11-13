import { createHmac } from "node:crypto";
import { HttpError, tooManyRequests } from "../../../platform/errors.js";
import type { Limiter } from "../../../platform/module.js";
import type { RateRule } from "../../../platform/rate-limit/limits.js";
import {
  MAX_ATTEMPTS,
  OTP_TTL_SEC,
  PER_DAY,
  PER_HOUR,
  PER_IP_HOUR,
  RESEND_GAP_SEC,
  compareCodeHash,
  generateCode,
} from "../domain/otp.js";
import type { OtpRepo } from "./ports.js";

export interface OtpService {
  /** Applies the rate limits, replaces older codes for the phone and returns the new code (delivery is the caller's job). */
  issue(phone: string, ip: string): Promise<{ code: string; expiresAt: Date }>;
  /** True when the code matches; throws `otp_expired` or `otp_invalid` (with `attemptsLeft`) otherwise. */
  verify(phone: string, code: string): Promise<true>;
}

export interface OtpServiceDeps {
  repo: OtpRepo;
  limiter: Limiter;
  clock: () => Date;
  pepper: string;
}

const hmac = (pepper: string, data: string) => createHmac("sha256", pepper).update(data).digest("hex");

export function createOtpService(deps: OtpServiceDeps): OtpService {
  const phoneHash = (phone: string) => hmac(deps.pepper, `p:${phone}`);
  const codeHash = (phone: string, code: string) => hmac(deps.pepper, `c:${phone}:${code}`);
  const rule = (limit: number, windowSeconds: number): RateRule => ({ limit, windowSeconds });

  return {
    async issue(phone, ip) {
      const ph = phoneHash(phone);
      const buckets: [string, RateRule][] = [
        [`otp:hour:${ph}`, rule(PER_HOUR, 3600)],
        [`otp:day:${ph}`, rule(PER_DAY, 86_400)],
        [`otp:ip:${ip}`, rule(PER_IP_HOUR, 3600)],
        [`otp:gap:${ph}`, rule(1, RESEND_GAP_SEC)],
      ];
      for (const [key, r] of buckets) {
        const res = await deps.limiter.hit(key, r);
        if (!res.allowed) throw tooManyRequests("otp_rate_limited", res.retryAfterSeconds);
      }
      const code = generateCode();
      const now = deps.clock();
      const expiresAt = new Date(now.getTime() + OTP_TTL_SEC * 1000);
      await deps.repo.replaceChallenge({ phoneHash: ph, codeHash: codeHash(phone, code), ip, now, expiresAt });
      return { code, expiresAt };
    },

    async verify(phone, code) {
      const now = deps.clock();
      const row = await deps.repo.findActive(phoneHash(phone));
      if (!row || row.expiresAt.getTime() < now.getTime()) throw new HttpError(401, "otp_expired", "Code expired");
      const invalid = (attemptsLeft: number) => new HttpError(401, "otp_invalid", "Invalid code", { attemptsLeft });
      if (row.attempts >= MAX_ATTEMPTS) throw invalid(0);
      // Count the try before comparing so parallel guesses cannot beat the limit.
      const attempts = await deps.repo.bumpAttempts(row.id, MAX_ATTEMPTS);
      if (attempts === null) throw invalid(0);
      if (!compareCodeHash(row.codeHash, codeHash(phone, code))) throw invalid(Math.max(0, MAX_ATTEMPTS - attempts));
      if (!(await deps.repo.consume(row.id, now))) throw invalid(0);
      return true;
    },
  };
}
