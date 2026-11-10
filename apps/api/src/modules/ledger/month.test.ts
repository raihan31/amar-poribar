import { describe, expect, it } from "vitest";
import { dayRange, monthRange } from "./domain/month.js";

describe("monthRange", () => {
  it("uses Dhaka month boundaries", () => {
    const { start, end } = monthRange("2026-12");
    expect(start.toISOString()).toBe("2026-11-30T18:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T18:00:00.000Z");
  });
});

describe("dayRange", () => {
  it("covers whole Dhaka days, inclusive of the last day", () => {
    const { start, end } = dayRange("2027-05-20", "2027-05-21");
    expect(start.toISOString()).toBe("2027-05-19T18:00:00.000Z");
    expect(end.toISOString()).toBe("2027-05-21T18:00:00.000Z");
  });
});
