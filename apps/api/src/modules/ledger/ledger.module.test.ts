import { describe, expect, it } from "vitest";
import { ledgerModule } from "./index.js";

describe("ledger module", () => {
  it("has the expected name", () => {
    expect(ledgerModule.name).toBe("ledger");
  });
});
