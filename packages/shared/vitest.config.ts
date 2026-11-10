import { defineConfig } from "vitest/config";

// Coverage gate (NFR-11): packages/* need >= 70% lines. Applies to `vitest run --coverage` only.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts"],
      thresholds: { lines: 70 },
    },
  },
});
