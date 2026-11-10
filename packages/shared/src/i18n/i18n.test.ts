import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { bn, en, t } from "./index.js";
import type { MessageKey } from "./index.js";

const script = resolve(import.meta.dirname, "../../../../tools/i18n-keys.mjs");

describe("i18n catalogue", () => {
  it("bn and en have identical key sets", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(bn).sort());
  });

  it("every message is non-empty and has error.* entries", () => {
    for (const k of Object.keys(bn)) {
      expect(bn[k as MessageKey].length).toBeGreaterThan(0);
      expect(en[k as MessageKey].length).toBeGreaterThan(0);
    }
    expect(t("error.unauthorized")).not.toBe("error.unauthorized");
  });

  it("interpolation replaces params", () => {
    const original = bn.joined;
    expect(t("joined", "en")).toBe("You joined the family");
    // placeholder syntax is exercised through a temporary catalogue entry
    (en as Record<string, string>)["tmp.hello"] = "Hello {name}, {n} items, {missing}";
    (bn as Record<string, string>)["tmp.hello"] = "হ্যালো {name}";
    expect(t("tmp.hello" as MessageKey, "en", { name: "Rahim", n: 3 })).toBe("Hello Rahim, 3 items, {missing}");
    expect(t("tmp.hello" as MessageKey, { name: "x" })).toBe("হ্যালো x");
    delete (en as Record<string, string>)["tmp.hello"];
    delete (bn as Record<string, string>)["tmp.hello"];
    expect(bn.joined).toBe(original);
  });

  it("missing key falls back to the key itself in production and throws in tests", () => {
    expect(() => t("nope.nothing" as MessageKey)).toThrow(/nope\.nothing/);
    const prev = { node: process.env.NODE_ENV, vitest: process.env.VITEST };
    process.env.NODE_ENV = "production";
    delete process.env.VITEST;
    try {
      expect(t("nope.nothing" as MessageKey)).toBe("nope.nothing");
    } finally {
      process.env.NODE_ENV = prev.node;
      if (prev.vitest !== undefined) process.env.VITEST = prev.vitest;
    }
  });
});

describe("tools/i18n-keys", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function fixture(webSource: string): string {
    const dir = mkdtempSync(join(tmpdir(), "i18n-"));
    dirs.push(dir);
    mkdirSync(join(dir, "packages/shared/src/i18n"), { recursive: true });
    mkdirSync(join(dir, "apps/web/app"), { recursive: true });
    writeFileSync(
      join(dir, "packages/shared/src/i18n/bn.ts"),
      'export const bn = {\n  hello: "হ্যালো",\n  "error.x": "ভুল",\n} as const;\n',
    );
    writeFileSync(
      join(dir, "packages/shared/src/i18n/en.ts"),
      'export const en = {\n  hello: "Hello",\n  "error.x": "Wrong",\n};\n',
    );
    writeFileSync(join(dir, "apps/web/app/page.tsx"), webSource);
    return dir;
  }
  const run = (dir: string) => spawnSync("node", [script, "--root", dir], { encoding: "utf8" });

  it("tools/i18n-keys detects a missing key", () => {
    const bad = run(fixture('export const a = t("hello") + t("not.there");'));
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain("not.there");
    const good = run(fixture('export const a = t("hello");'));
    expect(good.status).toBe(0);
  });

  it("tools/i18n-keys detects a bn/en mismatch", () => {
    const dir = fixture('t("hello")');
    writeFileSync(join(dir, "packages/shared/src/i18n/en.ts"), 'export const en = {\n  hello: "Hello",\n};\n');
    const res = run(dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("error.x");
  });
});
