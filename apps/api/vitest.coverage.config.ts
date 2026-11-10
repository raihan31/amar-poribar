import { defineConfig } from "vitest/config";

// Coverage gate for the API (NFR-11): module domain/ and app/ code needs >= 80% lines.
// Use cases are exercised by the API tests against PostgreSQL, so both projects of
// vitest.config.ts run here. Needs DATABASE_URL (or the compose `db-test` service).
// Run with `pnpm --filter @amar-poribar/api coverage`.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/modules/**/{domain,app}/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.d.ts"],
      thresholds: { lines: 80 },
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.db.test.ts", "**/node_modules/**"],
        },
      },
      {
        test: {
          name: "db",
          include: ["src/**/*.db.test.ts", "tests/**/*.test.ts", "../../tools/fixtures/src/**/*.db.test.ts"],
          fileParallelism: false,
          maxWorkers: 1,
          testTimeout: 30_000,
          hookTimeout: 120_000,
          globalSetup: ["tests/support/global-setup.ts"],
        },
      },
    ],
  },
});
