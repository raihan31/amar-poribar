import { describe, expect, it } from "vitest";
import { adminModule } from "./index.js";

describe("admin module", () => {
  it("has the expected name", () => {
    expect(adminModule.name).toBe("admin");
  });
});
