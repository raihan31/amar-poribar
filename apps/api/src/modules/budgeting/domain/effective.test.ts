import { describe, expect, it } from "vitest";
import { effectiveBudgets } from "./effective.js";

describe("effectiveBudgets", () => {
  it("inherits last month unless changed or cleared", () => {
    const rows = [
      { categoryId: "bazaar", month: "2026-09", limitPaisa: 800000 },
      { categoryId: "bazaar", month: "2026-10", limitPaisa: 900000 },
      { categoryId: "rent", month: "2026-09", limitPaisa: 1500000 },
      { categoryId: "rent", month: "2026-10", limitPaisa: 0 },
      { categoryId: null, month: "2026-09", limitPaisa: 4000000 },
      { categoryId: "future", month: "2026-12", limitPaisa: 1 },
    ];
    const got = effectiveBudgets(rows, "2026-11");
    expect(got.map((b) => [b.categoryId, b.limitPaisa, b.inherited])).toEqual([
      ["bazaar", 900000, true],
      [null, 4000000, true],
    ]);
    expect(effectiveBudgets(rows, "2026-10").find((b) => b.categoryId === "bazaar")?.inherited).toBe(false);
  });
});
