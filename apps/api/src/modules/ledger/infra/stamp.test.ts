import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stampChange } from "./stamp-change.js";

const base = join(import.meta.dirname, "..");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const sources = walk(base).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const isRepo = (f: string) => f.endsWith("infra/transactions.repo.ts");

describe("stampChange", () => {
  it("returns an hlc above the previous one", () => {
    const a = stampChange().hlc;
    expect(stampChange(a).hlc > a).toBe(true);
  });

  it("module never updates transactions without stampChange", () => {
    for (const f of sources) {
      const text = readFileSync(f, "utf8");
      // Only the repo's generic helpers may issue the statement; every caller of them must stamp.
      if (text.includes(".update(transactions)")) expect(isRepo(f), f).toBe(true);
      if (isRepo(f)) continue;
      if (/transactionsRepo\.(update|insert)\(/.test(text)) {
        expect(text.includes("stampChange("), `${f} writes transactions without stampChange`).toBe(true);
      }
    }
  });
});
