import { bn } from "./bn.js";
import { en } from "./en.js";
import type { MessageKey } from "./keys.js";

export type { MessageKey, StringKey } from "./keys.js";
export { bn, en };

export type Locale = "bn" | "en";
export type MessageParams = Record<string, string | number>;

const catalogues: Record<Locale, Record<string, string>> = { bn, en };

function isTestEnv(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.NODE_ENV === "test" || env?.VITEST !== undefined;
}

/**
 * Looks up a message. `t(key)`, `t(key, "en")`, `t(key, { name })` and `t(key, "en", { name })` all work.
 * `{name}` placeholders are replaced from params; format amounts with `fmtAmount` and pass them as params.
 * A missing key throws in tests and returns the key itself otherwise.
 */
export function t(key: MessageKey, locale?: Locale): string;
export function t(key: MessageKey, params: MessageParams): string;
export function t(key: MessageKey, locale: Locale, params: MessageParams): string;
export function t(key: MessageKey, a?: Locale | MessageParams, b?: MessageParams): string {
  const locale: Locale = typeof a === "string" ? a : "bn";
  const params = typeof a === "object" ? a : b;
  const template = catalogues[locale][key];
  if (template === undefined) {
    if (isTestEnv()) throw new Error(`Missing i18n key: ${String(key)}`);
    return String(key);
  }
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}
