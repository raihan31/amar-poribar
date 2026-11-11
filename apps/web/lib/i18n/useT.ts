"use client";

import { useCallback } from "react";
import { bn, en, type MessageKey } from "@amar-poribar/shared";
import { useI18n } from "./provider";
import { webBn, webEn, type WebKey } from "./web-strings";

export type TKey = WebKey | MessageKey;
export type TVars = Record<string, string | number>;

const warned = new Set<string>();

/** Pure lookup: web-strings first, then the shared catalogue. Missing: throws outside production. */
export function translate(locale: "bn" | "en", key: TKey, vars?: TVars): string {
  const web: Record<string, string> = locale === "bn" ? webBn : webEn;
  const shared: Record<string, string> = locale === "bn" ? bn : en;
  const template = web[key] ?? shared[key];
  if (template === undefined) {
    if (process.env.NODE_ENV !== "production") throw new Error(`Missing i18n key: ${key}`);
    if (!warned.has(key)) {
      warned.add(key);
      console.error(`Missing i18n key: ${key}`);
    }
    return key;
  }
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** `const t = useT()` then call it with a key and optional `{name}` vars. Works without a provider (Bangla). */
export function useT(): (key: TKey, vars?: TVars) => string {
  const { locale } = useI18n();
  return useCallback((key: TKey, vars?: TVars) => translate(locale, key, vars), [locale]);
}
