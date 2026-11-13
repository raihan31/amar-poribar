import { checkA11y, expect, needsBackend, test } from "../fixtures/test";

const PAGES: { link: string; path: string; heading: string }[] = [
  { link: "Overview", path: "/", heading: "Overview" },
  { link: "Families", path: "/families", heading: "Families" },
  { link: "Privacy requests", path: "/privacy", heading: "Privacy requests" },
  { link: "Plans & AI quota", path: "/plans", heading: "Plans & AI quota" },
  { link: "Audit log", path: "/audit", heading: "Audit log" },
  { link: "Staff accounts", path: "/staff", heading: "Staff accounts" },
  { link: "System health", path: "/health", heading: "System health" },
];

test.describe("navigation and accessibility", () => {
  needsBackend(test);

  test("login page passes axe", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Work email")).toBeVisible();
    await checkA11y(page);
  });

  test("every sidebar link reaches its page and passes axe", async ({ page, staff }) => {
    await staff("owner");
    const nav = page.getByRole("navigation", { name: "Console" });
    for (const p of PAGES) {
      await nav.getByRole("link", { name: new RegExp(`^${p.link.replace(/[&]/g, "\\$&")}`) }).click();
      await expect(page).toHaveURL(new RegExp(`${p.path === "/" ? "/$" : `${p.path}$`}`));
      await expect(page.getByRole("heading", { level: 1, name: p.heading })).toBeVisible();
      await expect(nav.locator("[aria-current=page]")).toHaveCount(1);
      await page.waitForLoadState("networkidle");
      await checkA11y(page);
    }
  });

  test("open dialogs pass axe", async ({ page, staff }) => {
    await staff("owner");
    await page.goto("/families");
    await page
      .getByRole("link", { name: /^Open / })
      .first()
      .click();
    await page.waitForURL(/\/families\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const [button, title] of [
      ["Change plan", "Change plan"],
      ["Add 50 entries", "Add AI entries"],
      ["Suspend family", "Suspend family"],
      [/^Delete family and data/, "Delete family and data"],
    ] as const) {
      await page.getByRole("button", { name: button }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { level: 2 })).toBeVisible();
      void title;
      await checkA11y(page);
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toHaveCount(0);
    }
  });
});
