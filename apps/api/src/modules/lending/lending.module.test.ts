import { describe, expect, it } from "vitest";
import { lendingModule } from "./index.js";

describe("lending module", () => {
  it("has the expected name", () => {
    expect(lendingModule.name).toBe("lending");
  });
});
