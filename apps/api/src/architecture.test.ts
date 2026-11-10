import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { MODULE_DEPS } from "./platform/arch/module-deps.js";
import { modules } from "./modules/registry.js";

const src = import.meta.dirname;
const modulesDir = join(src, "modules");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const tsFiles = walk(src).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const rel = (f: string) => relative(src, f);
const moduleNames = readdirSync(modulesDir).filter((n) => statSync(join(modulesDir, n)).isDirectory());

/** Tables still declared in the pre-modular schema; T-PLAT-31 deletes this exception. */
const LEGACY_SCHEMA_FILES = new Set(["db/schema.ts"]);

describe("modular monolith architecture", () => {
  it("every module folder has index.ts, schema.ts and events.ts (R9)", () => {
    for (const m of moduleNames) {
      for (const f of ["index.ts", "schema.ts", "events.ts"]) {
        expect(existsSync(join(modulesDir, m, f)), `modules/${m}/${f}`).toBe(true);
      }
    }
  });

  it("the module folders are exactly the modules in MODULE_DEPS", () => {
    expect([...moduleNames].sort()).toEqual(Object.keys(MODULE_DEPS).sort());
  });

  it("every dependsOn equals the SRS §3.3 table", () => {
    for (const m of modules) expect([...m.dependsOn].sort(), m.name).toEqual([...(MODULE_DEPS[m.name] ?? [])].sort());
  });

  it("registry order is a topological order of MODULE_DEPS (R2)", () => {
    const seen = new Set<string>();
    for (const m of modules) {
      for (const dep of MODULE_DEPS[m.name] ?? []) expect(seen.has(dep), `${m.name} before ${dep}`).toBe(true);
      seen.add(m.name);
    }
  });

  it("pgTable( is declared only in modules/*/schema.ts, platform and the legacy schema (R3)", () => {
    const offenders = tsFiles.filter((f) => {
      const r = rel(f);
      if (!readFileSync(f, "utf8").includes("pgTable(")) return false;
      return !(/^modules\/[^/]+\/schema\.ts$/.test(r) || r.startsWith("platform/") || LEGACY_SCHEMA_FILES.has(r));
    });
    expect(offenders.map(rel)).toEqual([]);
  });

  it("each pgSchema name equals its folder name (DEC-02)", () => {
    for (const m of moduleNames) {
      const text = readFileSync(join(modulesDir, m, "schema.ts"), "utf8");
      const names = [...text.matchAll(/pgSchema\("([^"]+)"\)/g)].map((x) => x[1]);
      for (const n of names) expect(n, `modules/${m}/schema.ts`).toBe(m);
    }
  });

  it("no foreign key points at another module's table (DEC-02)", () => {
    for (const m of moduleNames) {
      const text = readFileSync(join(modulesDir, m, "schema.ts"), "utf8");
      const imported = [...text.matchAll(/from "\.\.\/([^/]+)\//g)].map((x) => x[1]);
      expect(imported, `modules/${m}/schema.ts imports another module`).toEqual([]);
    }
  });

  it("only app.ts, the registry and composition import several module facades (R8)", () => {
    const allowed = (r: string) => r === "app.ts" || r === "modules/registry.ts" || r.startsWith("composition/");
    for (const f of tsFiles) {
      const r = rel(f);
      if (allowed(r) || r.startsWith("modules/")) continue;
      const targets = new Set([...readFileSync(f, "utf8").matchAll(/modules\/([^/"]+)\/index\.js/g)].map((x) => x[1]));
      expect(targets.size, r).toBeLessThanOrEqual(1);
    }
  });
});
