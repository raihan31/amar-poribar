import { createHmac } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  let bits = "";
  for (const ch of input.replace(/=+$/, "").toUpperCase()) {
    const v = B32.indexOf(ch);
    if (v < 0) throw new Error(`bad base32 character ${ch}`);
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** RFC 6238 TOTP: HMAC-SHA-1, 30 second step, 6 digits. `atMs` defaults to now. */
export function totpAt(secret: string, atMs: number = Date.now(), stepSeconds = 30): string {
  const counter = Math.floor(atMs / 1000 / stepSeconds);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const off = h[h.length - 1]! & 0x0f;
  const bin =
    ((h[off]! & 0x7f) << 24) | ((h[off + 1]! & 0xff) << 16) | ((h[off + 2]! & 0xff) << 8) | (h[off + 3]! & 0xff);
  return String(bin % 1_000_000).padStart(6, "0");
}

/** Accepts the current code and the previous and next step, as a real server does for clock drift. */
export function totpValid(secret: string, code: string, atMs: number = Date.now()): boolean {
  return [-1, 0, 1].some((d) => totpAt(secret, atMs + d * 30_000) === code);
}
