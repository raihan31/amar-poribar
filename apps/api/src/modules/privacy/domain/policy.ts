import { readFileSync } from "node:fs";

/** The privacy policy version shown on the consent screen (A2) and recorded by `identity.consents`. */
export const POLICY_VERSION = "2026-11-01";
/** When this version took effect. */
export const POLICY_UPDATED_AT = "2026-11-01T00:00:00.000Z";

export type PolicyLocale = "bn" | "en";
export const POLICY_LOCALES: readonly PolicyLocale[] = ["bn", "en"];

const cache = new Map<PolicyLocale, string>();

/** The markdown file as written, including the `<!--key-->` markers the content test reads. */
export function loadPolicyRaw(locale: PolicyLocale): string {
  let text = cache.get(locale);
  if (text === undefined) {
    text = readFileSync(new URL(`./policy-${locale}.md`, import.meta.url), "utf8");
    cache.set(locale, text);
  }
  return text;
}

/** The policy text served to clients: markdown without the test markers. */
export function loadPolicy(locale: PolicyLocale): string {
  return loadPolicyRaw(locale).replace(/ ?<!--[a-z_]+-->/g, "");
}

/** Days until a request must be completed (PDPO, FR-PRIV-03/04). */
export const REQUEST_DEADLINE_DAYS = 30;

export function requestDueAt(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + REQUEST_DEADLINE_DAYS * 24 * 60 * 60 * 1000);
}
