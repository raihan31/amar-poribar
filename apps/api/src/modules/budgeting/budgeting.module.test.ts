import { describe, expect, it } from "vitest";
import { budgetingModule } from "./index.js";

describe("budgeting module", () => {
  it("has the expected name", () => {
    expect(budgetingModule.name).toBe("budgeting");
  });
});
