import { describe, expect, it } from "vitest";
import { syncModule } from "./index.js";

describe("sync module", () => {
  it("has the expected name", () => {
    expect(syncModule.name).toBe("sync");
  });
});
