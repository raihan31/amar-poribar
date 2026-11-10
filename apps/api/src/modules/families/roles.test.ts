import { describe, expect, it } from "vitest";
import { canAssignRole, canEditAll, canManageMember } from "./domain/roles.js";

describe("role rules", () => {
  it("only owner assigns admin", () => {
    expect(canAssignRole("owner", "admin")).toBe(true);
    expect(canAssignRole("admin", "admin")).toBe(false);
    expect(canAssignRole("admin", "member")).toBe(true);
    expect(canAssignRole("member", "viewer")).toBe(false);
  });

  it("nobody assigns owner", () => {
    expect(canAssignRole("owner", "owner")).toBe(false);
    expect(canAssignRole("admin", "owner")).toBe(false);
  });

  it("admin manages members but not admins", () => {
    expect(canManageMember("admin", "owner")).toBe(false);
    expect(canManageMember("owner", "owner")).toBe(false);
    expect(canManageMember("admin", "admin")).toBe(false);
    expect(canManageMember("owner", "admin")).toBe(true);
    expect(canManageMember("admin", "viewer")).toBe(true);
    expect(canManageMember("member", "viewer")).toBe(false);
  });

  it("admins and owners edit everything", () => {
    expect(canEditAll("admin")).toBe(true);
    expect(canEditAll("member")).toBe(false);
  });
});
