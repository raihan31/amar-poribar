import { defineConfig } from "@playwright/test";

// Minimal config so the e2e specs can run; T-ADMUI-14 owns the full desktop/visual setup.
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  use: {
    baseURL: process.env.ADMIN_E2E_STACK_URL ?? "http://localhost:3100",
    locale: "en-GB",
    timezoneId: "Asia/Dhaka",
    viewport: { width: 1280, height: 800 },
  },
});
