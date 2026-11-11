import { randomInt, timingSafeEqual } from "node:crypto";

export const OTP_TTL_SEC = 300;
export const MAX_ATTEMPTS = 5;
export const RESEND_GAP_SEC = 60;
export const PER_HOUR = 5;
export const PER_DAY = 20;
export const PER_IP_HOUR = 30;

/** A uniformly random six-digit code, zero-padded. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Constant-time comparison of two hex digests; false when the lengths differ. */
export function compareCodeHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
