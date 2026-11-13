import { test as base, expect, type Page } from "@playwright/test";
import { currentTotp } from "../helpers/totp";
import { MOCK, STACK, staffFor, type StaffRole } from "./staff";

export { expect, MOCK, STACK };
export { checkA11y } from "../helpers/a11y";
export { freezeClock, snap, FROZEN_NOW } from "../helpers/visual";
export { currentTotp, wrongTotp } from "../helpers/totp";
export { staffFor, type StaffRole } from "./staff";

/** Signs in through the real login form with email, password and a current TOTP code. */
export async function signIn(page: Page, role: StaffRole): Promise<void> {
  const s = staffFor(role);
  await page.goto("/login");
  await page.getByLabel("Work email").fill(s.email);
  await page.getByLabel("Password", { exact: true }).fill(s.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Digit 1").waitFor();
  await page.getByLabel("Digit 1").fill(currentTotp(s.totpSecret));
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** The CSRF header every state-changing call to the admin proxy needs. */
export const CSRF = { "x-ap-csrf": "1" } as const;

export const test = base.extend<{ staff: (role: StaffRole) => Promise<void> }>({
  staff: async ({ page }, provide) => {
    await provide((role) => signIn(page, role));
  },
});

/** Skip a spec unless the mock API or a Compose stack is available. */
export function needsBackend(t: typeof test): void {
  t.skip(!MOCK && !STACK, "needs the mock API (MOCK=1) or a Compose stack (ADMIN_E2E_STACK_URL)");
}
