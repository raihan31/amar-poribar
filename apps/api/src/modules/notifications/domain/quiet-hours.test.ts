import { describe, expect, it } from "vitest";
import { isQuietAt } from "./quiet-hours.js";

// Asia/Dhaka is UTC+6.
const dhaka = (hhmm: string) => new Date(`2026-01-15T${hhmm}:00+06:00`);

describe("isQuietAt", () => {
  it("overnight window quiet at 23:00", () => {
    expect(isQuietAt(dhaka("23:00"), "22:00", "06:00")).toBe(true);
    expect(isQuietAt(dhaka("22:00"), "22:00", "06:00")).toBe(true);
    expect(isQuietAt(dhaka("12:00"), "22:00", "06:00")).toBe(false);
  });
  it("quiet at 05:59", () => {
    expect(isQuietAt(dhaka("05:59"), "22:00", "06:00")).toBe(true);
  });
  it("not quiet at 06:00", () => {
    expect(isQuietAt(dhaka("06:00"), "22:00", "06:00")).toBe(false);
  });
  it("same-day window", () => {
    expect(isQuietAt(dhaka("13:00"), "13:00", "15:00")).toBe(true);
    expect(isQuietAt(dhaka("14:59"), "13:00", "15:00")).toBe(true);
    expect(isQuietAt(dhaka("15:00"), "13:00", "15:00")).toBe(false);
    expect(isQuietAt(dhaka("12:59"), "13:00", "15:00")).toBe(false);
  });
  it("start equals end never quiet", () => {
    expect(isQuietAt(dhaka("22:00"), "22:00", "22:00")).toBe(false);
    expect(isQuietAt(dhaka("03:00"), "08:00", "08:00")).toBe(false);
  });
  it("uses Asia/Dhaka across UTC midnight", () => {
    // 19:00Z on the 14th is 01:00 on the 15th in Dhaka.
    expect(isQuietAt(new Date("2026-01-14T19:00:00Z"), "22:00", "06:00")).toBe(true);
    expect(isQuietAt(new Date("2026-01-14T23:30:00Z"), "22:00", "06:00")).toBe(true);
    // 00:00Z is 06:00 Dhaka.
    expect(isQuietAt(new Date("2026-01-15T00:00:00Z"), "22:00", "06:00")).toBe(false);
    // 16:00Z is 22:00 Dhaka.
    expect(isQuietAt(new Date("2026-01-15T16:00:00Z"), "22:00", "06:00")).toBe(true);
  });
});
