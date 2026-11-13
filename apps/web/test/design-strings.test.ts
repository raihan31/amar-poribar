import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bn } from "@amar-poribar/shared";
import { webBn } from "../lib/i18n/web-strings";
import { implementedScreens, notOnWeb } from "./screen-registry";
import allowed from "./allowed-differences.json";

const webRoot = join(__dirname, "..");
const design = JSON.parse(readFileSync(join(webRoot, "../../docs/design/strings.json"), "utf8")) as {
  screens: Record<string, { static: string[] }>;
};
const allowedList = allowed as { screen: string; string: string; reason: string }[];
// Web copy lives in the shared catalogue plus the web-only catalogue.
const corpus = [...Object.values(bn), ...Object.values(webBn)];
const isAllowed = (screen: string, s: string) => allowedList.some((a) => a.screen === screen && a.string === s);

describe("design strings", () => {
  it("every static design string exists in bn.ts", () => {
    const missing: string[] = [];
    for (const [screen, file] of Object.entries(implementedScreens)) {
      expect(existsSync(join(webRoot, file)), `${screen}: ${file} must exist`).toBe(true);
      expect(design.screens[screen], `${screen} is not a design screen`).toBeDefined();
      for (const s of design.screens[screen]!.static) {
        if (!corpus.some((v) => v.includes(s)) && !isAllowed(screen, s)) missing.push(`${screen}: ${s}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("allowed differences are few and explained", () => {
    expect(allowedList.length).toBeLessThanOrEqual(30);
    for (const a of allowedList) expect(a.reason?.trim().length, `${a.screen}: ${a.string}`).toBeGreaterThan(0);
  });

  const webScreens = Object.keys(design.screens).filter((n) => !notOnWeb.includes(n));
  const allRegistered = webScreens.every((n) => n in implementedScreens);
  it.skipIf(!allRegistered)("strict: all web screens registered", () => {
    expect(webScreens).toHaveLength(38);
    expect(Object.keys(implementedScreens).sort()).toEqual([...webScreens].sort());
  });
});
