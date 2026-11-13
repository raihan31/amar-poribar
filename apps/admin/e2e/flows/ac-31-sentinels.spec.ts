import { expect, test, type Page, type Response } from "@playwright/test";
import { fetchClient, makeFamily, makeTransactions, makeUser } from "@amar-poribar/fixtures";
import { findSentinels, SENTINELS } from "../helpers/sentinels";

/**
 * AC-31 (UI side): no private family value reaches a staff screen or an admin proxy response.
 * Needs the Compose stack (`pnpm stack:up`) and one staff account per role, supplied as
 * ADMIN_E2E_STAFF_<ROLE>=email:password:totpCode (roles OWNER, SUPPORT, READONLY).
 */
const STACK = process.env.ADMIN_E2E_STACK_URL;
const API_URL = process.env.ADMIN_E2E_API_URL ?? "http://localhost:3000";
const ROLES = ["OWNER", "SUPPORT", "READONLY"] as const;
const ROUTES = ["/", "/families", "/privacy", "/plans", "/audit", "/staff", "/health"] as const;

async function signIn(page: Page, role: (typeof ROLES)[number]): Promise<void> {
  const creds = process.env[`ADMIN_E2E_STAFF_${role}`];
  if (!creds) throw new Error(`ADMIN_E2E_STAFF_${role} is not set`);
  const [email, password, code] = creds.split(":") as [string, string, string];
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.getByLabel(/code/i).fill(code);
  await page.getByRole("button", { name: /verify|sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** Seeds a family whose data contains every sentinel, through the public API. Returns its id. */
async function seedSentinelFamily(): Promise<string> {
  const api = fetchClient(API_URL, process.env.ADMIN_E2E_FAKES_URL);
  const owner = await makeUser(api, { phone: SENTINELS.phone.replace(/^\+88/, "") });
  const family = await makeFamily(api, owner, { name: "Sentinel Family" });
  const txns = await makeTransactions(api, owner.accessToken, family.id, 3, { seed: 31 });
  const token = { token: owner.accessToken };
  const first = txns[0]!;
  for (const [i, extra] of [
    { note: SENTINELS.note, counterparty: SENTINELS.counterparty, trxId: SENTINELS.trxId },
    { note: SENTINELS.privateNote, isPrivate: true },
  ].entries()) {
    const t = txns[i]!;
    await api.put(
      `/v1/families/${family.id}/transactions/${t.id}`,
      { ...t, ...extra, categoryId: first.categoryId, accountId: first.accountId },
      token,
    );
  }
  await api.post(`/v1/families/${family.id}/chat/messages`, { body: SENTINELS.chatBody }, token);
  await api.post(`/v1/families/${family.id}/voice-notes`, { mediaId: SENTINELS.mediaId }, token);
  return family.id;
}

for (const role of ROLES) {
  test.describe(`AC-31 staff data boundary (${role.toLowerCase()})`, () => {
    test.skip(!STACK, "needs the Compose stack: set ADMIN_E2E_STACK_URL (and the staff credentials)");

    test("no sentinel reaches any admin screen or response", async ({ page }) => {
      const familyId = await seedSentinelFamily();
      const bodies: { url: string; text: string }[] = [];
      page.on("response", (res: Response) => {
        if (!res.url().includes("/api/proxy/admin/")) return;
        void res
          .text()
          .then((text) => bodies.push({ url: res.url(), text }))
          .catch(() => undefined);
      });

      await signIn(page, role);
      const routes = [...ROUTES, `/families/${familyId}`];
      for (const route of routes) {
        if (role !== "OWNER" && role !== "SUPPORT" && route === "/staff") continue;
        await page.goto(route);
        await page.waitForLoadState("networkidle");

        expect(findSentinels(await page.content()), `${role} ${route} html`).toEqual([]);

        const phones = page.locator('[data-column="phone"], td[data-label="Phone"]');
        for (const text of await phones.allTextContents()) {
          expect(text.trim()).toMatch(/^•••\s?\d{3}$/);
        }
      }
      for (const { url, text } of bodies) {
        expect(findSentinels(text), `${role} response ${url}`).toEqual([]);
        expect(findSentinels(decodeURIComponent(url)), `${role} url`).toEqual([]);
      }
      expect(bodies.length, "the crawl must have observed admin responses").toBeGreaterThan(0);
    });
  });
}
