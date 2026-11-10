import { buildApp } from "../../app.js";
import type { Db } from "../../db/client.js";

export { apiRoot, apiVersion } from "./version.js";

/** Recursively sort object keys so the committed file is stable. */
export function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, sortKeys(x)]),
    );
  }
  return v;
}

/** Counts operations flagged `x-undocumented` (no response schema yet). */
export function countUndocumented(doc: { paths?: Record<string, Record<string, unknown>> }): number {
  let n = 0;
  for (const item of Object.values(doc.paths ?? {})) {
    for (const op of Object.values(item)) {
      if (op && typeof op === "object" && (op as Record<string, unknown>)["x-undocumented"] === true) n++;
    }
  }
  return n;
}

/** Builds the app with fakes and a stub db, and returns the OpenAPI document with sorted keys. */
export async function buildOpenApiDocument() {
  const app = await buildApp({
    db: {} as Db,
    jwtSecret: "openapi-build",
    isProd: false,
    logLevel: "silent",
    openapiPublic: true,
  });
  try {
    await app.ready();
    return sortKeys(app.swagger()) as { paths: Record<string, Record<string, unknown>> };
  } finally {
    await app.close();
  }
}

export const serialize = (doc: unknown) => JSON.stringify(doc, null, 2) + "\n";
