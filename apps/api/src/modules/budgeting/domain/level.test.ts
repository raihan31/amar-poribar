import { describe, expect, it } from "vitest";
import { budgetLevel } from "./level.js";

describe("budgetLevel", () => {
  it("alerts at 80% and 100%", () => {
    expect(budgetLevel(7999, 10000)).toBe("ok");
    expect(budgetLevel(8000, 10000)).toBe("warning");
    expect(budgetLevel(9999, 10000)).toBe("warning");
    expect(budgetLevel(10000, 10000)).toBe("exceeded");
    expect(budgetLevel(5000, 0)).toBe("ok");
  });
});
