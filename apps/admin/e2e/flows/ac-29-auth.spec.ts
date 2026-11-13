import { API_URL } from "../fixtures/staff";
import { CSRF, MOCK, STACK, expect, needsBackend, signIn, staffFor, test, wrongTotp } from "../fixtures/test";

/**
 * AC-29: staff sign-in is email + password + TOTP, five wrong attempts lock the account for 15 minutes,
 * and a staff session can never be used on family routes.
 * Runs against the mock admin API (`MOCK=1`) or the Compose stack (`ADMIN_E2E_STACK_URL`).
 */
test.describe("AC-29 staff authentication", () => {
  needsBackend(test);

  test("sign-in requires TOTP", async ({ page, context }) => {
    const s = staffFor("owner");
    await page.goto("/login");
    await page.getByLabel("Work email").fill(s.email);
    await page.getByLabel("Password", { exact: true }).fill(s.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    // Password alone: the code step shows and no session cookie exists.
    await expect(page.getByLabel("Digit 1")).toBeVisible();
    expect((await context.cookies()).some((c) => c.name === "ap_staff")).toBe(false);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/families");
    await expect(page).toHaveURL(/\/login/);

    // A wrong code is refused and still no session.
    await page.goto("/login");
    await page.getByLabel("Work email").fill(s.email);
    await page.getByLabel("Password", { exact: true }).fill(s.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByLabel("Digit 1").fill(wrongTotp(s.totpSecret));
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "That code is not correct" })).toBeVisible();
    expect((await context.cookies()).some((c) => c.name === "ap_staff")).toBe(false);

    // The right code reaches the console.
    await signIn(page, "owner");
    await expect(page.getByRole("navigation", { name: "Console" })).toBeVisible();
  });

  test("five wrong attempts lock for 15 minutes", async ({ page, request }) => {
    const email = MOCK ? "locked@amar.test" : (process.env.ADMIN_E2E_LOCKOUT_EMAIL ?? staffFor("support").email);
    test.skip(
      !MOCK && !process.env.ADMIN_E2E_LOCKOUT_EMAIL,
      "set ADMIN_E2E_LOCKOUT_EMAIL to a disposable staff account",
    );
    await page.goto("/login");
    for (let i = 0; i < 5; i++) {
      await page.getByLabel("Work email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(`wrong-password-${i}`);
      await page.getByRole("button", { name: "Sign in" }).click();
      if (i < 4) await expect(page.getByText("Email or password is not correct.")).toBeVisible();
    }
    const notice = page.getByRole("alert").filter({ hasText: "This account is locked." });
    await expect(notice).toContainText(/Try again in 1[45]:\d\d/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();

    // Advance the server clock past the lock. The mock API takes it on the login call; a Compose stack
    // exposes ADMIN_E2E_CLOCK_URL (POST {advanceSeconds}).
    const clock = process.env.ADMIN_E2E_CLOCK_URL;
    if (MOCK) {
      await request.post("/api/staff/login", { headers: CSRF, data: { mockAdvanceSeconds: 15 * 60 + 1 } });
    } else if (clock) {
      await request.post(clock, { data: { advanceSeconds: 15 * 60 + 1 } });
    } else return;
    await page.reload();
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(MOCK ? staffFor("owner").password : "wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    if (MOCK) await expect(page.getByLabel("Digit 1")).toBeVisible();
    else await expect(notice).toHaveCount(0);
  });

  test("staff cookie fails on family routes", async ({ page, request, context }) => {
    await signIn(page, "owner");
    // The admin proxy only forwards /admin/v1/*; family routes do not exist there.
    const viaProxy = await page.request.get("/api/proxy/v1/me");
    expect(viaProxy.status()).toBe(404);

    // The staff token itself is also useless on the family API.
    if (STACK) {
      const token = (await context.cookies()).find((c) => c.name === "ap_staff")?.value;
      expect(token).toBeTruthy();
      const direct = await request.get(`${API_URL}/v1/me`, { headers: { authorization: `Bearer ${token}` } });
      expect(direct.status()).toBe(401);
    }
  });
});
