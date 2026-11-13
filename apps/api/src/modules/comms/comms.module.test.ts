import { describe, expect, it } from "vitest";
import { commsModule } from "./index.js";

describe("comms module", () => {
  it("has the expected name", () => {
    expect(commsModule.name).toBe("comms");
  });
});
