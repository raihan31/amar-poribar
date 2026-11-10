import { randomBytes } from "node:crypto";

let lastMs = 0;
let seq = 0;

/** Timestamp-ordered UUID (RFC 9562 v7). Monotonic within one process, also inside the same millisecond. */
export function uuid7(now: number = Date.now()): string {
  let ms = Math.max(now, lastMs);
  if (ms === lastMs) {
    seq += 1;
    if (seq > 0xfff) {
      ms += 1;
      seq = 0;
    }
  } else {
    seq = 0;
  }
  lastMs = ms;
  const b = randomBytes(16);
  b.writeUIntBE(ms, 0, 6);
  b[6] = 0x70 | (seq >> 8);
  b[7] = seq & 0xff;
  b[8] = 0x80 | (b[8]! & 0x3f);
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
