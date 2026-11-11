import { describe, expect, it } from "vitest";
import { makeFormatters } from "./format";
import { parsePrefs } from "./cookie";

describe("format", () => {
  it("money uses lakh grouping and Bangla digits", () => {
    const f = makeFormatters({ locale: "bn", numerals: "bn" });
    expect(f.money(12_500_000)).toBe("৳ ১,২৫,০০০");
    expect(f.num(125000)).toBe("১,২৫,০০০");
  });

  it("latin numerals when ap_num=latn", () => {
    const p = parsePrefs((n) => ({ ap_loc: "bn", ap_num: "latn" })[n]);
    const f = makeFormatters(p);
    expect(f.money(12_500_000)).toBe("৳ 1,25,000");
    expect(f.num(125000)).toBe("1,25,000");
    expect(f.date("2026-01-15T12:00:00Z")).toMatch(/15/);
  });

  it("relative time in Bangla", () => {
    const f = makeFormatters({ locale: "bn", numerals: "bn" });
    const now = Date.parse("2026-01-15T12:00:00Z");
    expect(f.relative("2026-01-15T11:55:00Z", now)).toBe("৫ মিনিট আগে");
  });

  it("defaults follow cookies", () => {
    expect(parsePrefs(() => undefined)).toEqual({ locale: "bn", numerals: "bn", simple: false });
    expect(parsePrefs((n) => ({ ap_loc: "en", ap_simple: "1" })[n])).toEqual({
      locale: "en",
      numerals: "latn",
      simple: true,
    });
  });
});
