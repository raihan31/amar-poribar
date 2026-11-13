import { describe, expect, it } from "vitest";
import { familiesModule } from "./index.js";

describe("families module", () => {
  it("has the expected name", () => {
    expect(familiesModule.name).toBe("families");
  });
});
