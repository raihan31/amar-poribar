import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WRITE_FLAG_ALLOWLIST, findUnflaggedMutatingRoutes } from "./route-write-flag.js";

const modulesDir = join(import.meta.dirname, "../../modules");

function routeFiles(module: string): string[] {
  const dir = join(modulesDir, module, "http");
  try {
    if (!statSync(dir).isDirectory()) return [];
  } catch {
    return [];
  }
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(dir, f));
}

describe("mutating routes pass { write: true } to requireRole (FR-FAM-09)", () => {
  it("lint test finds a mutating route without write flag", () => {
    const fixture = readFileSync(join(import.meta.dirname, "fixtures/unflagged.routes.txt"), "utf8");
    expect(findUnflaggedMutatingRoutes(fixture)).toEqual(["POST /v1/families/:familyId/things"]);
  });

  it("every mutating family-scoped route outside the allowlist carries the flag", () => {
    const offenders: string[] = [];
    for (const m of readdirSync(modulesDir)) {
      if (WRITE_FLAG_ALLOWLIST.has(m)) continue;
      for (const f of routeFiles(m)) {
        for (const o of findUnflaggedMutatingRoutes(readFileSync(f, "utf8"))) offenders.push(`${m}: ${o}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
