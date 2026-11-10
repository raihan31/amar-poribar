import { describe, expect, it } from "vitest";
import { shoppingModule } from "./index.js";

describe("shopping module", () => {
  it("has the expected name", () => {
    expect(shoppingModule.name).toBe("shopping");
  });
});
