import { describe, expect, it } from "vitest";
import { privacyModule } from "./index.js";

describe("privacy module", () => {
  it("has the expected name", () => {
    expect(privacyModule.name).toBe("privacy");
  });
});
