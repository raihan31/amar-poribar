import { describe, expect, it } from "vitest";
import { ROLE_RANK, canAssignRole, canEditAll, canManageMember } from "./domain/roles.js";

describe("role rules", () => {
  it("owner outranks admin", () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.member);
    expect(ROLE_RANK.member).toBeGreaterThan(ROLE_RANK.viewer);
  });

  it("only owner can assign admin", () => {
    expect(canAssignRole("owner", "admin")).toBe(true);
    expect(canAssignRole("admin", "admin")).toBe(false);
    expect(canAssignRole("admin", "member")).toBe(true);
    expect(canAssignRole("member", "viewer")).toBe(false);
  });

  it("nobody can assign owner", () => {
    expect(canAssignRole("owner", "owner")).toBe(false);
    expect(canAssignRole("admin", "owner")).toBe(false);
  });

  it("admin cannot manage another admin", () => {
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
