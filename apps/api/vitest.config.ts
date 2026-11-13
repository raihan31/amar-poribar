import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
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
          // Fixture builders are tested here because they need the API and a database.
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
