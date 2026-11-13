import { describe, expect, it } from "vitest";
import { reachedThresholds } from "./thresholds.js";

describe("reachedThresholds", () => {
  it("is empty below 80 percent", () => expect(reachedThresholds(7_999, 10_000)).toEqual([]));
  it("reaches 80 exactly at 80 percent", () => expect(reachedThresholds(8_000, 10_000)).toEqual([80]));
  it("reaches both at 100 percent", () => expect(reachedThresholds(10_000, 10_000)).toEqual([80, 100]));
  it("never alerts for a zero limit", () => expect(reachedThresholds(5, 0)).toEqual([]));
});
