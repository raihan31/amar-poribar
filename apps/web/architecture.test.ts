import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = __dirname;
const SKIP = new Set(["node_modules", ".next", "e2e"]);
// Server-side BFF (route handlers) and auth helpers talk to the upstream API directly.
const ALLOWED = [/^lib\/api\/client\.ts$/, /^lib\/auth\//, /^lib\/media\/upload\.ts$/, /^app\/api\//];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

describe("architecture", () => {
  it("only api client calls fetch", () => {
    const offenders = walk(root)
      .map((f) => relative(root, f))
      .filter((f) => !ALLOWED.some((re) => re.test(f)))
      .filter((f) => /(^|[^.\w])fetch\s*\(/.test(readFileSync(join(root, f), "utf8")));
    expect(offenders).toEqual([]);
  });
});
