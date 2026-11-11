export type StaffRole = "owner" | "support" | "readonly";
export type Action = "view" | "change_plan" | "suspend" | "delete_data" | "handle_privacy" | "manage_staff";

/** Matrix of AdminStaff.dc.html. Transferring ownership is a privacy-request outcome, covered by handle_privacy. */
const MATRIX: Record<StaffRole, readonly Action[]> = {
  owner: ["view", "change_plan", "suspend", "delete_data", "handle_privacy", "manage_staff"],
  support: ["view", "change_plan", "handle_privacy"],
  readonly: ["view"],
};

/** Unknown roles from newer servers fall back to least privilege. */
export function normalizeRole(role: string | undefined): StaffRole {
  if (role === "owner" || role === "support") return role;
  return "readonly";
}

export function can(role: string | undefined, action: Action): boolean {
  return MATRIX[normalizeRole(role)].includes(action);
}

export const ROLE_LABEL: Record<StaffRole, string> = { owner: "Owner", support: "Support", readonly: "Read-only" };
