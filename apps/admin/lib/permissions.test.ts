import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("permissions", () => {
  it("owner can do everything", () => {
    for (const a of ["view", "change_plan", "suspend", "delete_data", "handle_privacy", "manage_staff"] as const) {
      expect(can("owner", a)).toBe(true);
    }
  });
  it("support cannot suspend", () => {
    expect(can("support", "suspend")).toBe(false);
    expect(can("support", "change_plan")).toBe(true);
    expect(can("support", "handle_privacy")).toBe(true);
    expect(can("support", "manage_staff")).toBe(false);
  });
  it("read-only has no actions", () => {
    expect(can("readonly", "view")).toBe(true);
    for (const a of ["change_plan", "suspend", "delete_data", "handle_privacy", "manage_staff"] as const) {
      expect(can("readonly", a)).toBe(false);
    }
    expect(can("something-new", "suspend")).toBe(false);
  });
});
