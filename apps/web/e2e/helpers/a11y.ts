import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import allow from "../a11y-allow.json" with { type: "json" };

/** Fails on any WCAG 2.0/2.1 A/AA violation except rule ids listed in `e2e/a11y-allow.json`. */
export async function checkA11y(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const allowed = new Set(allow as string[]);
  const violations = results.violations
    .filter((v) => !allowed.has(v.id))
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
  expect(violations, "axe violations").toEqual([]);
}
