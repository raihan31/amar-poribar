import type { Page } from "@playwright/test";
import { expect, freezeClock, needsBackend, signIn, snap, test } from "../fixtures/test";

/** Visual baselines (C0..C4, G1..G4) with the clock frozen at 2026-11-11T10:00:00+06:00. */
const FAMILY = "/families/fam_8f2c9d0e7b6a41a";

const SCREENS: { id: string; path: string; ready: string; signedIn: boolean }[] = [
  { id: "C0-login", path: "/login", ready: "Work email", signedIn: false },
  { id: "C1-overview", path: "/", ready: "Overview", signedIn: true },
  { id: "C2-families", path: "/families", ready: "Families", signedIn: true },
  { id: "C3-family", path: FAMILY, ready: "রহিম পরিবার", signedIn: true },
  { id: "C4-privacy", path: "/privacy", ready: "Privacy requests", signedIn: true },
  { id: "G1-plans", path: "/plans", ready: "Plans & AI quota", signedIn: true },
  { id: "G2-audit", path: "/audit", ready: "Audit log", signedIn: true },
  { id: "G3-staff", path: "/staff", ready: "Staff accounts", signedIn: true },
  { id: "G4-health", path: "/health", ready: "System health", signedIn: true },
];

async function show(page: Page, s: (typeof SCREENS)[number]): Promise<void> {
  await freezeClock(page);
  if (s.signedIn) await signIn(page, "owner");
  await page.goto(s.path);
  await expect(page.getByText(s.ready, { exact: false }).first()).toBeVisible();
}

test.describe("visual screens", () => {
  needsBackend(test);
  // Baselines come from the pinned Linux image (scripts/snapshots-docker.sh); other hosts render fonts differently.
  test.skip(process.platform !== "linux", "baselines are Linux only: run scripts/snapshots-docker.sh check");
  test.use({ colorScheme: "light", reducedMotion: "reduce" });

  for (const s of SCREENS) {
    test(`${s.id} at 1280x800`, async ({ page }) => {
      await show(page, s);
      await snap(page, `${s.id}-1280`);
    });
  }

  test.describe("stacked sidebar at 390x844", () => {
    test.use({ viewport: { width: 390, height: 844 } });
    for (const s of SCREENS.filter((x) => ["C1-overview", "C2-families", "C3-family"].includes(x.id))) {
      test(`${s.id} at 390x844`, async ({ page }) => {
        await show(page, s);
        await snap(page, `${s.id}-390`);
      });
    }
  });
});

test.describe("design conformance", () => {
  needsBackend(test);
  test.use({ colorScheme: "light" });

  test("inputs are at least 44 px high", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Work email")).toBeVisible();
    const heights = await page
      .locator("input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea")
      .evaluateAll((els) =>
        els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.getBoundingClientRect().height),
      );
    expect(heights.length).toBeGreaterThan(0);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });

  test("status pills contain an icon and text", async ({ page }) => {
    await signIn(page, "owner");
    for (const path of ["/families", "/audit", "/health"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const pills = await page.locator(".ui-pill:not(.ui-pill--neutral)").evaluateAll((els) =>
        els.map((e) => ({
          icon: !!e.querySelector('[data-testid="pill-icon"]'),
          text: (e.textContent ?? "").replace(/[✓⚠■ⓘ]/g, "").trim(),
        })),
      );
      for (const p of pills) {
        expect(p.icon, `${path}: pill without icon`).toBe(true);
        expect(p.text.length, `${path}: pill without text`).toBeGreaterThan(0);
      }
    }
  });

  for (const width of [1280, 390]) {
    test(`no horizontal page scroll at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await signIn(page, "owner");
      for (const path of ["/", "/families", FAMILY, "/privacy", "/plans", "/audit", "/staff", "/health"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const over = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(over, `${path} overflows by ${over}px at ${width}`).toBeLessThanOrEqual(0);
      }
    });
  }

  test("token colours equal the design values", async ({ page }) => {
    await signIn(page, "owner");
    const tokens = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const get = (n: string) => cs.getPropertyValue(n).trim().toLowerCase();
      return {
        bg: get("--bg"),
        ink: get("--ink"),
        green: get("--green-700"),
        danger: get("--danger"),
        amber: get("--amber"),
        sidebar: getComputedStyle(document.querySelector(".sidebar")!).backgroundColor,
      };
    });
    expect(tokens).toEqual({
      bg: "#fff8ee",
      ink: "#2a2118",
      green: "#1b5e20",
      danger: "#b3261e",
      amber: "#f2a33a",
      sidebar: "rgb(20, 69, 26)", // #14451A, the design's sidebar green
    });
  });
});
