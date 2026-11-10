import { randomInt } from "node:crypto";
import type { OtpStore } from "../app/ports.js";

interface Pending {
  code: string;
  expiresAt: number;
  attempts: number;
}

const EXPIRY_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

/**
 * In-memory OTP store for development and tests: 5 minute expiry, 5 attempts per code.
 * The DB-backed store with per-number rate limiting (NFR-05) arrives in T-ID-01.
 */
export class MemoryOtpStore implements OtpStore {
  private pending = new Map<string, Pending>();

  constructor(private readonly now: () => number = Date.now) {}

  async issue(phone: string): Promise<string> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    this.pending.set(phone, { code, expiresAt: this.now() + EXPIRY_MS, attempts: 0 });
    return code;
  }

  async verify(phone: string, code: string): Promise<boolean> {
    const entry = this.pending.get(phone);
    if (!entry || entry.expiresAt < this.now() || entry.attempts >= MAX_ATTEMPTS) return false;
    entry.attempts += 1;
    if (entry.code !== code) return false;
    this.pending.delete(phone);
    return true;
  }
}
