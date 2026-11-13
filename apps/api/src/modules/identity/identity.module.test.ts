import { describe, expect, it } from "vitest";
import { identityModule } from "./index.js";

describe("identity module", () => {
  it("has the expected name", () => {
    expect(identityModule.name).toBe("identity");
  });
});
