const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Replace Bangla digits (০-৯) with Latin digits (0-9). */
export function bnToLatinDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/** Replace Latin digits (0-9) with Bangla digits (০-৯). */
export function latinToBnDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]!);
}

/** Convert a taka amount (may have up to 2 decimals) to integer paisa. */
export function takaToPaisa(taka: number): number {
  if (!Number.isFinite(taka)) throw new RangeError("Amount must be a finite number");
  return Math.round(taka * 100);
}

export function paisaToTaka(paisa: number): number {
  return paisa / 100;
}

/**
 * Parse a human-written amount such as "1,00,000", "৳ ২,৩৪০.৫০" or "Tk 850" to paisa.
 * Returns null when no number can be read.
 */
export function parseAmountToPaisa(input: string): number | null {
  const cleaned = bnToLatinDigits(input).replace(/[,\s]/g, "");
  const match = cleaned.match(/\d+(?:\.\d{1,2})?/);
  if (!match) return null;
  return takaToPaisa(Number(match[0]));
}

/** Group digits the South Asian way: 1,25,000 / 1,00,00,000. */
function groupLakh(intPart: string): string {
  if (intPart.length <= 3) return intPart;
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

export interface FormatOptions {
  /** Use Bangla numerals (১,২৫,০০০) instead of Latin (1,25,000). */
  bnDigits?: boolean;
  /** Prefix with the taka sign. Defaults to true. */
  symbol?: boolean;
}

/** Format paisa as BDT with lakh grouping, e.g. 12500000 → "৳ 1,25,000". */
export function formatBDT(paisa: number, opts: FormatOptions = {}): string {
  const { bnDigits = false, symbol = true } = opts;
  const negative = paisa < 0;
  const abs = Math.abs(Math.round(paisa));
  const intPart = groupLakh(String(Math.floor(abs / 100)));
  const fraction = abs % 100;
  let out = fraction ? `${intPart}.${String(fraction).padStart(2, "0")}` : intPart;
  if (bnDigits) out = latinToBnDigits(out);
  if (negative) out = `-${out}`;
  return symbol ? `৳ ${out}` : out;
}
