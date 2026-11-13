import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { modules } from "./registry.js";

const EXPECTED = [
  "identity",
  "families",
  "billing",
  "ledger",
  "budgeting",
  "recurring",
  "ai",
  "reporting",
  "sync",
  "notifications",
  "comms",
  "shopping",
  "lending",
  "privacy",
  "admin",
];

describe("module registry", () => {
  it("registers every module exactly once", () => {
    const names = modules.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    expect([...names].sort()).toEqual([...EXPECTED].sort());
  });

  it("registers modules after their dependsOn", () => {
    const seen = new Set<string>();
    for (const m of modules) {
      for (const dep of m.dependsOn) expect(seen.has(dep), `${m.name} needs ${dep} first`).toBe(true);
      seen.add(m.name);
    }
  });

  it("gen:module creates the expected tree", () => {
    const root = mkdtempSync(join(tmpdir(), "gm-test-"));
    execFileSync("node", ["tools/gen-module.mjs", "demo", "families", "--root", root], {
      cwd: join(import.meta.dirname, "../../../.."),
    });
    for (const f of [
      "index.ts",
      "schema.ts",
      "events.ts",
      "jobs.ts",
      "demo.module.test.ts",
      "http/.gitkeep",
      "domain/.gitkeep",
    ]) {
      expect(existsSync(join(root, "modules/demo", f)), f).toBe(true);
    }
    expect(readFileSync(join(root, "modules/demo/index.ts"), "utf8")).toContain('dependsOn: ["families"]');
  });
});
