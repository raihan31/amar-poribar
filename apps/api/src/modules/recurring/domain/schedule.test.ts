import { describe, expect, it } from "vitest";
import { dueDateIn, isDueIn, reminderState } from "./schedule.js";

const base = {
  dayOfMonth: 5,
  startsOn: "2026-01-01",
  endsOn: null,
  active: true,
  lastConfirmedMonth: null,
  remindDaysBefore: 2,
};

describe("recurring schedule", () => {
  it("dueDateIn clamps day 31 to month end", () => {
    expect(dueDateIn("2026-02", 31)).toBe("2026-02-28");
    expect(dueDateIn("2028-02", 30)).toBe("2028-02-29");
    expect(dueDateIn("2026-11", 31)).toBe("2026-11-30");
    expect(dueDateIn("2026-11", 5)).toBe("2026-11-05");
  });

  it("isDueIn respects start and end", () => {
    expect(isDueIn(base, "2026-11")).toBe(true);
    expect(isDueIn({ ...base, lastConfirmedMonth: "2026-11" }, "2026-11")).toBe(false);
    expect(isDueIn({ ...base, lastConfirmedMonth: "2026-10" }, "2026-11")).toBe(true);
    expect(isDueIn({ ...base, startsOn: "2026-11-06" }, "2026-11")).toBe(false);
    expect(isDueIn({ ...base, endsOn: "2026-10-31" }, "2026-11")).toBe(false);
    expect(isDueIn({ ...base, active: false }, "2026-11")).toBe(false);
  });

  it("reminderState days until due", () => {
    expect(reminderState(base, "2026-11-02")).toBeNull();
    expect(reminderState(base, "2026-11-03")).toEqual({ due: "2026-11-05", daysUntil: 2 });
    expect(reminderState(base, "2026-11-09")).toEqual({ due: "2026-11-05", daysUntil: -4 });
    expect(reminderState({ ...base, lastConfirmedMonth: "2026-11" }, "2026-11-09")).toBeNull();
  });
});
