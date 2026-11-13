import type { Page } from "@playwright/test";
import { test, expect, checkA11y } from "../fixtures/test";
import { demo } from "../helpers/mockApi";

/** Every screen that exists in the web app (SRS target structure, §0.2). */
const ROUTES = [
  "/",
  "/list",
  "/budget",
  "/family",
  "/add",
  "/add/voice",
  "/add/sms",
  "/settings",
  "/profile",
  "/accounts",
  "/categories",
  "/switch-family",
  `/txn/${demo.transactions[2]!.id}`,
];

const BANGLA = /[ঀ-৿]/;
/** User data is allowed to stay Bangla in English mode: names of the family, people and accounts. */
const USER_DATA = [
  demo.family.name,
  ...demo.members.map((m) => m.name ?? ""),
  ...demo.accounts.map((a) => a.name),
  // Avatars show the first letter of a name; the language switch itself is labelled in its own language.
  ...[demo.family.name, ...demo.members.map((m) => m.name ?? ""), ...demo.accounts.map((a) => a.name)].map(
    (n) => Array.from(n)[0] ?? "",
  ),
  "বাংলা",
  // Label of the "Bangla numerals" choice; it shows the numerals it names.
  "১২৩",
].filter(Boolean);

/** The taka sign belongs to the currency, not to the language. */
const TAKA = "\u09F3";

/** Waits until the screen text stops changing (data arrived), without fixed sleeps. */
async function settled(page: Page): Promise<void> {
  let last = "";
  let same = 0;
  await expect
    .poll(
      async () => {
        const now = await page.evaluate(() => document.body.innerText);
        same = now === last && now.length > 0 ? same + 1 : 0;
        last = now;
        return same;
      },
      { intervals: [150], timeout: 10_000 },
    )
    .toBeGreaterThanOrEqual(3);
}

async function visibleText(page: Page): Promise<string> {
  let text = await page.evaluate(() => document.body.innerText);
  for (const allowed of [...USER_DATA].sort((a, b) => b.length - a.length)) text = text.split(allowed).join("");
  return text.split(TAKA).join("");
}

test("every tab screen switches language @mock", async ({ page, context, baseURL, mockUser: _ }) => {
  void _;
  test.setTimeout(120_000);
  const problems: string[] = [];
  for (const route of ROUTES) {
    await context.addCookies([{ name: "ap_loc", value: "bn", url: baseURL! }]);
    await page.goto(route);
    await expect(page.locator(".app-content")).toBeVisible();
    await settled(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "bn");
    const bn = await visibleText(page);
    if (/missing key/i.test(bn)) problems.push(`bn ${route}: missing key marker`);
    if (!BANGLA.test(bn)) problems.push(`bn ${route}: no Bangla text`);

    await context.addCookies([
      { name: "ap_loc", value: "en", url: baseURL! },
      { name: "ap_num", value: "latn", url: baseURL! },
    ]);
    await page.goto(route);
    await expect(page.locator(".app-content")).toBeVisible();
    await settled(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    const en = await visibleText(page);
    if (/missing key/i.test(en)) problems.push(`en ${route}: missing key marker`);
    const leak = [...en.matchAll(/\S*[ঀ-৿]+\S*/g)].map((m) => m[0]);
    if (leak.length > 0) problems.push(`en ${route}: Bangla text ${JSON.stringify(leak.slice(0, 5))}`);
  }
  expect(problems).toEqual([]);

  await page.goto("/");
  await checkA11y(page);
});
