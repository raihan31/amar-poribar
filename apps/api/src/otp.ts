import { randomInt } from "node:crypto";

interface Pending {
  code: string;
  expiresAt: number;
  attempts: number;
}

/**
 * In-memory OTP store for development.
 * TODO(P1): replace with Redis/Postgres storage and a Bangladeshi SMS gateway, plus
 * per-number rate limiting (NFR-05: 5 per hour).
 */
export class OtpStore {
  private pending = new Map<string, Pending>();

  issue(phone: string): string {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    this.pending.set(phone, { code, expiresAt: Date.now() + 5 * 60_000, attempts: 0 });
    return code;
  }

  verify(phone: string, code: string): boolean {
    const entry = this.pending.get(phone);
    if (!entry || entry.expiresAt < Date.now() || entry.attempts >= 5) return false;
    entry.attempts += 1;
    if (entry.code !== code) return false;
    this.pending.delete(phone);
    return true;
  }
}
