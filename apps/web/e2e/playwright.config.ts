import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.AP_BASE_URL ?? "http://localhost:3000";
const mock = process.env.AP_MOCK === "1";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  outputDir: "./test-results",
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}",
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" } },
  use: { baseURL, trace: "on-first-retry", video: "retain-on-failure" },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        locale: "bn-BD",
        timezoneId: "Asia/Dhaka",
      },
    },
    {
      name: "desktop-web",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        locale: "bn-BD",
        timezoneId: "Asia/Dhaka",
      },
    },
  ],
  // Assumes `pnpm --filter @amar-poribar/web build` has run (the acceptance command does that first).
  webServer: process.env.AP_BASE_URL
    ? undefined
    : {
        command: "pnpm --filter @amar-poribar/web start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { ...(mock ? { AP_MOCK: "1" } : {}), PORT: "3000" } as Record<string, string>,
      },
});
