import { describe, expect, it } from "vitest";
import { delta, monthLabel, shiftMonth } from "./month";

describe("month helpers", () => {
  it("shiftMonth crosses year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
    expect(shiftMonth("2026-03", 0)).toBe("2026-03");
  });

  it("delta returns null when previous is 0", () => {
    expect(delta(500, 0)).toBeNull();
    expect(delta(150, 100)).toEqual({ pct: 50, dir: "up" });
    expect(delta(50, 100)).toEqual({ pct: 50, dir: "down" });
    expect(delta(100, 100)).toEqual({ pct: 0, dir: "flat" });
  });

  it("monthLabel formats long month and year", () => {
    expect(monthLabel("2026-01", "en-US")).toBe("January 2026");
  });
});
