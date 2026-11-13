import { defineConfig } from "@playwright/test";

const PORT = process.env.ADMIN_E2E_PORT ?? "3100";
const stackUrl = process.env.ADMIN_E2E_STACK_URL;
const baseURL = stackUrl ?? `http://localhost:${PORT}`;
const mock = process.env.MOCK === "1";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  outputDir: "../test-results",
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}",
  // The mock API holds state (audit log, lockout counters), so specs run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" } },
  use: {
    baseURL,
    locale: "en-GB",
    timezoneId: "Asia/Dhaka",
    trace: "on-first-retry",
  },
  projects: [{ name: "desktop", use: { viewport: { width: 1280, height: 800 } } }],
  // Assumes `pnpm --filter @amar-poribar/admin build` has run. Not started when a Compose stack URL is given.
  webServer: stackUrl
    ? undefined
    : {
        command: `pnpm exec next start -p ${PORT}`,
        cwd: "..",
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { ...(mock ? { AP_MOCK: "1" } : {}), PORT } as Record<string, string>,
      },
});
