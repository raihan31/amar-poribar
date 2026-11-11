import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { bn, en } from "@amar-poribar/shared";
import { webBn, webEn } from "./web-strings";
import { translate, type TKey } from "./useT";

const root = join(__dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

describe("web i18n catalogue", () => {
  it("bn and en have identical key sets", () => {
    expect(Object.keys(webEn).sort()).toEqual(Object.keys(webBn).sort());
    expect(Object.keys(en).sort()).toEqual(Object.keys(bn).sort());
  });

  it("no unused keys (grep components)", () => {
    const source = [...walk(join(root, "components")), ...walk(join(root, "app")), ...walk(join(root, "lib"))]
      .filter((f) => !f.endsWith("web-strings.ts"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    const unused = Object.keys(webBn).filter((k) => !source.includes(`"${k}"`));
    expect(unused).toEqual([]);
  });

  it("no Bangla literals in components", () => {
    // Allow list: aria-label fixtures may carry Bangla when marked with `i18n-allow`.
    const offenders = walk(join(root, "components"))
      .map((f) => ({
        f: relative(root, f),
        lines: readFileSync(f, "utf8")
          .split("\n")
          .filter((l) => /[ঀ-৲৴-৿]/.test(l) && !/i18n-allow/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l)),
      }))
      .filter((x) => x.lines.length > 0);
    expect(offenders).toEqual([]);
  });

  it("missing key throws outside production", () => {
    expect(() => translate("bn", "nope.nothing" as TKey)).toThrow(/Missing i18n key/);
  });

  it("interpolates {name}", () => {
    expect(translate("en", "joined")).toBe(en.joined);
  });
});
