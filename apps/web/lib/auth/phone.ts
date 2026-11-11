import { BdPhoneSchema, normalizeBdPhone } from "@amar-poribar/shared";

const BN_ZERO = 0x09e6;

/** Bangla digits to ASCII; everything else is unchanged. */
export function fromBnDigits(s: string): string {
  return s.replace(/[০-৯]/g, (c) => String(c.charCodeAt(0) - BN_ZERO));
}

/** ASCII digits to Bangla digits. */
export function toBnDigits(s: string): string {
  return s.replace(/\d/g, (c) => String.fromCharCode(BN_ZERO + Number(c)));
}

/** Keeps only digits (Bangla or ASCII), drops a typed 88 country prefix, and caps at 11 digits. */
export function cleanPhoneInput(raw: string): string {
  let d = fromBnDigits(raw).replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("88")) d = d.slice(2);
  return d.slice(0, 11);
}

/** `01712345678` to `০১৭১২ ৩৪৫ ৬৭৮` for display. */
export function formatPhoneDisplay(digits: string): string {
  const g = [digits.slice(0, 5), digits.slice(5, 8), digits.slice(8, 11)].filter(Boolean).join(" ");
  return toBnDigits(g);
}

export type ParsedPhone = { ok: true; e164: string } | { ok: false };

/** Accepts `01XXXXXXXXX`, `+8801…`, `8801…` (Bangla or ASCII digits); returns `+8801XXXXXXXXX`. */
export function parsePhone(input: string): ParsedPhone {
  const compact = fromBnDigits(input).replace(/[\s-]/g, "");
  if (!BdPhoneSchema.safeParse(compact).success) return { ok: false };
  return { ok: true, e164: normalizeBdPhone(compact) };
}
