/**
 * Lint helper for FR-FAM-09: every POST/PUT/PATCH/DELETE handler of a family-scoped module must call
 * `requireRole(..., { write: true })`, otherwise a suspended family could still change data.
 */

/**
 * Modules whose routes are exempt. identity and privacy are account-level; families manages membership and
 * must stay usable (staff transfer, invites) while suspended; notifications are per-user; ai parse/ask/receipt
 * do not change family data; sync, billing and admin check the flag in their own app layer or are staff-only.
 */
export const WRITE_FLAG_ALLOWLIST: ReadonlySet<string> = new Set([
  "identity",
  "privacy",
  "families",
  "notifications",
  "ai",
  "sync",
  "billing",
  "admin",
]);

const ROUTE = /\bapp\.(get|post|put|patch|delete)\s*(?:<[^>]*(?:<[^>]*>[^>]*)*>)?\s*\(\s*(?:\n\s*)?(["'`])([^"'`]+)\2/g;

/** Returns `"METHOD path"` for each mutating handler in `source` whose text lacks `write: true`. */
export function findUnflaggedMutatingRoutes(source: string): string[] {
  const matches = [...source.matchAll(ROUTE)];
  const offenders: string[] = [];
  matches.forEach((m, i) => {
    const method = m[1]!.toUpperCase();
    if (method === "GET") return;
    const end = matches[i + 1]?.index ?? source.length;
    const body = source.slice(m.index, end);
    if (!/\bwrite\s*:\s*true\b/.test(body)) offenders.push(`${method} ${m[3]}`);
  });
  return offenders;
}
