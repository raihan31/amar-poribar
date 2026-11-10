import { describe, expect, it } from "vitest";
import { budgetLevel, effectiveBudgets } from "./domain/budget-level.js";

describe("budgetLevel", () => {
  it("alerts at 80% and 100%", () => {
    expect(budgetLevel(7999, 10000)).toBe("ok");
    expect(budgetLevel(8000, 10000)).toBe("warning");
    expect(budgetLevel(9999, 10000)).toBe("warning");
    expect(budgetLevel(10000, 10000)).toBe("exceeded");
    expect(budgetLevel(5000, 0)).toBe("ok");
  });
});

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
