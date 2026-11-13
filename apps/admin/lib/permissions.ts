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

export const STAFF_ROLES: readonly StaffRole[] = ["owner", "support", "readonly"];

/** Rows of the "What each role can do" matrix, in design order. Generated from MATRIX so it cannot drift. */
export const PERMISSION_ROWS: readonly { action: Action; label: string }[] = [
  { action: "view", label: "View families (counts only)" },
  { action: "change_plan", label: "Change plan or quota" },
  { action: "suspend", label: "Suspend a family" },
  { action: "delete_data", label: "Delete family data" },
  { action: "handle_privacy", label: "Handle privacy requests" },
  { action: "manage_staff", label: "Manage staff" },
];
