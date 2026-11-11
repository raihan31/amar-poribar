import type { TKey } from "@/lib/i18n/useT";

/** Hour of day (0-23) in Asia/Dhaka. */
export function dhakaHour(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Dhaka" }).format(now);
  return Number(h) % 24;
}

/** Greeting key by Dhaka hour: morning 5-11, noon 12-15, evening 16-19, night otherwise. */
export function greetingKey(hour: number): TKey {
  if (hour >= 5 && hour < 12) return "home.greeting.morning";
  if (hour >= 12 && hour < 16) return "home.greeting.noon";
  if (hour >= 16 && hour < 20) return "home.greeting.evening";
  return "home.greeting.night";
}

/** Bangla possessive for a name: "বাজার" becomes "বাজারের", "শিক্ষা" becomes "শিক্ষার". */
export function bnPossessive(name: string): string {
  const last = [...name.trim()].pop() ?? "";
  const endsInVowelSign = /[া-ৌৗঅ-ঔ]/.test(last);
  return endsInVowelSign ? `${name}র` : `${name}ের`;
}

const BN_IN: Record<number, string> = {
  1: "জানুয়ারিতে",
  2: "ফেব্রুয়ারিতে",
  3: "মার্চে",
  4: "এপ্রিলে",
  5: "মে মাসে",
  6: "জুনে",
  7: "জুলাইয়ে",
  8: "আগস্টে",
  9: "সেপ্টেম্বরে",
  10: "অক্টোবরে",
  11: "নভেম্বরে",
  12: "ডিসেম্বরে",
};

/** "YYYY-MM" as the month word used in "নভেম্বরে খরচ" (Bangla "in month" form, or the English name). */
export function monthIn(month: string, locale: "bn" | "en"): string {
  const n = Number(month.split("-")[1]);
  if (locale === "bn") return BN_IN[n] ?? month;
  return new Date(`${month}-01T00:00:00+06:00`).toLocaleDateString("en-IN", { month: "long", timeZone: "Asia/Dhaka" });
}
