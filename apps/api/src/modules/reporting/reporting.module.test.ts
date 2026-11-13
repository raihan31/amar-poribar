import { describe, expect, it } from "vitest";
import { reportingModule } from "./index.js";

describe("reporting module", () => {
  it("has the expected name", () => {
    expect(reportingModule.name).toBe("reporting");
  });
});
