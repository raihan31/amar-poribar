import { describe, expect, it } from "vitest";
import { billingModule } from "./index.js";

describe("billing module", () => {
  it("has the expected name", () => {
    expect(billingModule.name).toBe("billing");
  });
});
