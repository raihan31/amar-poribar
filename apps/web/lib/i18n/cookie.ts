export const LOC_COOKIE = "ap_loc";
export const NUM_COOKIE = "ap_num";
export const SIMPLE_COOKIE = "ap_simple";
const ONE_YEAR = 365 * 24 * 60 * 60;

export type Locale = "bn" | "en";
export type Numerals = "bn" | "latn";

export interface Prefs {
  locale: Locale;
  numerals: Numerals;
  simple: boolean;
}

export const DEFAULT_PREFS: Prefs = { locale: "bn", numerals: "bn", simple: false };

/** Pure parser shared by the server layout (`cookies()`) and the client (`document.cookie`). */
export function parsePrefs(get: (name: string) => string | undefined): Prefs {
  const locale: Locale = get(LOC_COOKIE) === "en" ? "en" : "bn";
  const num = get(NUM_COOKIE);
  // No explicit choice: Bangla digits with Bangla, Latin digits with English.
  const numerals: Numerals = num === "latn" || num === "bn" ? num : locale === "bn" ? "bn" : "latn";
  return { locale, numerals, simple: get(SIMPLE_COOKIE) === "1" };
}

/** Writes the three preference cookies (readable by the server on the next request). */
export function writePrefCookies(prefs: Prefs): void {
  if (typeof document === "undefined") return;
  const attrs = `; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  document.cookie = `${LOC_COOKIE}=${prefs.locale}${attrs}`;
  document.cookie = `${NUM_COOKIE}=${prefs.numerals}${attrs}`;
  document.cookie = `${SIMPLE_COOKIE}=${prefs.simple ? "1" : "0"}${attrs}`;
}
