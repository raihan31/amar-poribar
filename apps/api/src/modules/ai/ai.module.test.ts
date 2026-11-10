import { describe, expect, it } from "vitest";
import { aiModule } from "./index.js";

describe("ai module", () => {
  it("has the expected name", () => {
    expect(aiModule.name).toBe("ai");
  });
});
