import { totpAt } from "../../mocks/totp";

/** Current RFC 6238 code (SHA-1, 30 s, 6 digits) for a base32 secret. `offsetSteps` shifts by whole 30 s steps. */
export function currentTotp(secret: string, offsetSteps = 0): string {
  return totpAt(secret, Date.now() + offsetSteps * 30_000);
}

/** A code that is guaranteed to be wrong for `secret` right now (and one step either side). */
export function wrongTotp(secret: string): string {
  const bad = new Set([-1, 0, 1].map((d) => currentTotp(secret, d)));
  for (let n = 0; n < 1_000_000; n += 111_111) {
    const c = String(n).padStart(6, "0");
    if (!bad.has(c)) return c;
  }
  return "000001";
}
