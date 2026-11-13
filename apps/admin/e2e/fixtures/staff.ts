import { MOCK_PASSWORD, MOCK_TOTP_SECRET } from "../../mocks/constants";

export type StaffRole = "owner" | "support" | "readonly";

export interface StaffCreds {
  role: StaffRole;
  email: string;
  password: string;
  /** Base32 TOTP secret seeded for this account. */
  totpSecret: string;
}

/** True when the specs run against the mock admin API (`pnpm e2e:mock`). */
export const MOCK = process.env.MOCK === "1";
/** True when they run against the Compose stack. */
export const STACK = !!process.env.ADMIN_E2E_STACK_URL;
export const API_URL = process.env.ADMIN_E2E_API_URL ?? "http://localhost:3000";

const MOCK_EMAIL: Record<StaffRole, string> = {
  owner: "owner@amar.test",
  support: "support@amar.test",
  readonly: "readonly@amar.test",
};

/**
 * Staff for a role. Mock mode uses the built-in accounts. Against Compose, `ADMIN_E2E_STAFF_<ROLE>` holds
 * `email:password:totpSecret`, written by the stack seed (`tools/fixtures`); one account exists per role.
 */
export function staffFor(role: StaffRole): StaffCreds {
  if (MOCK) return { role, email: MOCK_EMAIL[role], password: MOCK_PASSWORD, totpSecret: MOCK_TOTP_SECRET };
  const raw = process.env[`ADMIN_E2E_STAFF_${role.toUpperCase()}`];
  if (!raw) throw new Error(`ADMIN_E2E_STAFF_${role.toUpperCase()} is not set (email:password:totpSecret)`);
  const [email, password, totpSecret] = raw.split(":") as [string, string, string];
  return { role, email, password, totpSecret };
}
