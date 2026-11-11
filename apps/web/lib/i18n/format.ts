"use client";

import { useMemo } from "react";
import { formatBDT } from "@amar-poribar/shared";
import { useI18n } from "./provider";
import { translate } from "./useT";
import type { Prefs } from "./cookie";

const TZ = "Asia/Dhaka";

/** BCP 47 tag with the numbering system forced by the user's numeral setting. */
export function localeTag(p: Pick<Prefs, "locale" | "numerals">): string {
  const base = p.locale === "bn" ? "bn-BD" : "en-IN";
  return `${base}-u-nu-${p.numerals === "bn" ? "beng" : "latn"}`;
}

export type DateStyle = "short" | "long" | "time";

const DATE_OPTS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: "numeric", month: "short", year: "numeric" },
  long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  time: { hour: "numeric", minute: "2-digit" },
};

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export interface Formatters {
  money: (paisa: number, opts?: { symbol?: boolean }) => string;
  num: (n: number) => string;
  date: (iso: string, style?: DateStyle) => string;
  relative: (iso: string, now?: number) => string;
  /** Name of a category-like record in the current language. */
  name: (x: { nameBn: string; nameEn: string }) => string;
  tag: string;
}

export function makeFormatters(p: Pick<Prefs, "locale" | "numerals">): Formatters {
  const tag = localeTag(p);
  const bnDigits = p.numerals === "bn";
  return {
    tag,
    money: (paisa, opts) => formatBDT(paisa, { bnDigits, symbol: opts?.symbol }),
    num: (n) => n.toLocaleString(tag),
    date: (iso, style = "short") =>
      new Intl.DateTimeFormat(tag, { ...DATE_OPTS[style], timeZone: TZ }).format(new Date(iso)),
    relative: (iso, now = Date.now()) => {
      const secs = Math.round((new Date(iso).getTime() - now) / 1000);
      const abs = Math.abs(secs);
      if (abs < 60) return translate(p.locale, "relative.now");
      const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
      const [unit, size] = UNITS.find(([, s]) => abs >= s) ?? UNITS[UNITS.length - 1]!;
      return rtf.format(Math.trunc(secs / size), unit);
    },
    name: (x) => (p.locale === "bn" ? x.nameBn : x.nameEn),
  };
}

export function useFormat(): Formatters {
  const { locale, numerals } = useI18n();
  return useMemo(() => makeFormatters({ locale, numerals }), [locale, numerals]);
}
