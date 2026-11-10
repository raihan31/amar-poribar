import { describe, expect, it } from "vitest";
import { recurringModule } from "./index.js";

describe("recurring module", () => {
  it("has the expected name", () => {
    expect(recurringModule.name).toBe("recurring");
  });
});
