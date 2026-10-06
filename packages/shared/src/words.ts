/**
 * Spell out numbers in Bangla words (South Asian system: হাজার, লাখ, কোটি).
 * Text-to-speech engines read "৳ ২,৩৪০" unreliably, and many low-literacy users
 * understand spoken amounts better than digits (SRS FR-VOICE-05).
 */

// Bangla has a distinct word for every number from 0 to 99.
const UNDER_100 = [
  "শূন্য", "এক", "দুই", "তিন", "চার", "পাঁচ", "ছয়", "সাত", "আট", "নয়",
  "দশ", "এগারো", "বারো", "তেরো", "চৌদ্দ", "পনেরো", "ষোলো", "সতেরো", "আঠারো", "উনিশ",
  "বিশ", "একুশ", "বাইশ", "তেইশ", "চব্বিশ", "পঁচিশ", "ছাব্বিশ", "সাতাশ", "আঠাশ", "ঊনত্রিশ",
  "ত্রিশ", "একত্রিশ", "বত্রিশ", "তেত্রিশ", "চৌত্রিশ", "পঁয়ত্রিশ", "ছত্রিশ", "সাঁইত্রিশ", "আটত্রিশ", "ঊনচল্লিশ",
  "চল্লিশ", "একচল্লিশ", "বিয়াল্লিশ", "তেতাল্লিশ", "চুয়াল্লিশ", "পঁয়তাল্লিশ", "ছেচল্লিশ", "সাতচল্লিশ", "আটচল্লিশ", "ঊনপঞ্চাশ",
  "পঞ্চাশ", "একান্ন", "বাহান্ন", "তিপ্পান্ন", "চুয়ান্ন", "পঞ্চান্ন", "ছাপ্পান্ন", "সাতান্ন", "আটান্ন", "ঊনষাট",
  "ষাট", "একষট্টি", "বাষট্টি", "তেষট্টি", "চৌষট্টি", "পঁয়ষট্টি", "ছেষট্টি", "সাতষট্টি", "আটষট্টি", "ঊনসত্তর",
  "সত্তর", "একাত্তর", "বাহাত্তর", "তিয়াত্তর", "চুয়াত্তর", "পঁচাত্তর", "ছিয়াত্তর", "সাতাত্তর", "আটাত্তর", "ঊনআশি",
  "আশি", "একাশি", "বিরাশি", "তিরাশি", "চুরাশি", "পঁচাশি", "ছিয়াশি", "সাতাশি", "আটাশি", "ঊননব্বই",
  "নব্বই", "একানব্বই", "বিরানব্বই", "তিরানব্বই", "চুরানব্বই", "পঁচানব্বই", "ছিয়ানব্বই", "সাতানব্বই", "আটানব্বই", "নিরানব্বই",
] as const;

/** Spell a non-negative integer in Bangla words, e.g. 125000 → "এক লাখ পঁচিশ হাজার". */
export function numberToBanglaWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new RangeError("Expected a non-negative integer");
  if (n < 100) return UNDER_100[n]!;

  const parts: string[] = [];
  const crore = Math.floor(n / 1_00_00_000);
  const lakh = Math.floor((n % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((n % 1_00_000) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;

  if (crore) parts.push(`${numberToBanglaWords(crore)} কোটি`);
  if (lakh) parts.push(`${UNDER_100[lakh]} লাখ`);
  if (thousand) parts.push(`${UNDER_100[thousand]} হাজার`);
  if (hundred) parts.push(`${UNDER_100[hundred]}শো`);
  if (rest) parts.push(UNDER_100[rest]!);
  return parts.join(" ");
}

/** Spoken amount, e.g. 234050 paisa → "দুই হাজার তিনশো চল্লিশ টাকা পঞ্চাশ পয়সা" (bn) or "2,340.50 taka" (en). */
export function amountInWords(paisa: number, locale: "bn" | "en" = "bn"): string {
  const abs = Math.abs(Math.round(paisa));
  const taka = Math.floor(abs / 100);
  const poisha = abs % 100;
  if (locale === "en") {
    const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(abs / 100);
    return `${num} taka`;
  }
  let out = `${numberToBanglaWords(taka)} টাকা`;
  if (poisha) out += ` ${numberToBanglaWords(poisha)} পয়সা`;
  return out;
}

const MONTHS_BN = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10" → "অক্টোবর" / "October". */
export function monthName(month: string, locale: "bn" | "en" = "bn"): string {
  const idx = Number(month.slice(5, 7)) - 1;
  return (locale === "bn" ? MONTHS_BN : MONTHS_EN)[idx] ?? month;
}

const WORD_VALUE = new Map<string, number>(UNDER_100.map((w, i) => [w, i]));
// Common spoken/spelling variants.
for (const [w, v] of [
  ["ছয়", 6], ["ছ", 6], ["নয়", 9], ["ষোল", 16], ["এগার", 11], ["বার", 12], ["তের", 13], ["পনের", 15], ["সতের", 17], ["আঠার", 18],
] as const) WORD_VALUE.set(w, v);

const MULTIPLIERS = new Map<string, number>([
  ["হাজার", 1000], ["লাখ", 1_00_000], ["লক্ষ", 1_00_000], ["কোটি", 1_00_00_000],
]);

/**
 * Read an amount spoken in Bangla words, e.g. "আটশো পঞ্চাশ" → 850, "দেড় হাজার" → 1500,
 * "সাড়ে তিন হাজার" → 3500. Returns null when the text has no number words.
 * Speech recognisers sometimes write numbers as words, especially for informal speech.
 */
export function parseBanglaNumberWords(text: string): number | null {
  const tokens = text.split(/[\s,।]+/).map((t) => t.replace(/(টাকা|টাকার|টাকায়)$/, "")).filter(Boolean);
  let total = 0;
  let current = 0;
  let half = false;
  let seen = false;

  const hundredsOf = (token: string): number | null => {
    const m = token.match(/^(.+?)(শো|শ)$/);
    if (!m) return null;
    if (m[1] === "এক" || m[1] === "এ") return 100;
    const v = WORD_VALUE.get(m[1]!);
    return v !== undefined && v < 10 ? v * 100 : null;
  };

  for (const token of tokens) {
    if (token === "সাড়ে") { half = true; seen = true; continue; }
    if (token === "দেড়") { current += 1.5; seen = true; continue; }
    if (token === "আড়াই") { current += 2.5; seen = true; continue; }
    const mult = MULTIPLIERS.get(token);
    if (mult) {
      total += ((current || 1) + (half ? 0.5 : 0)) * mult;
      current = 0; half = false; seen = true;
      continue;
    }
    const hundreds = hundredsOf(token);
    if (hundreds !== null) {
      current += hundreds + (half ? 50 : 0);
      half = false; seen = true;
      continue;
    }
    const v = WORD_VALUE.get(token);
    if (v !== undefined) { current += v; seen = true; continue; }
    if (seen && (total || current)) break; // number phrase ended
  }
  const result = Math.round(total + current);
  return seen && result > 0 ? result : null;
}
