import tseslint from "typescript-eslint";
import amar from "./tools/eslint-rules/staff-safe.mjs";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/coverage/**",
      "apps/mobile/**",
      "**/*.g.dart",
      "apps/api/drizzle/**",
      "apps/api/arch-fixtures/**",
      "**/next-env.d.ts",
      "**/*.mjs",
      "**/*.cjs",
    ],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "packages/*/vitest.config.ts",
            "packages/*/src/*.test.ts",
            "packages/*/src/*/*.test.ts",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      // Fastify plugins are `async` by contract even when they only register routes.
      "@typescript-eslint/require-await": "off",
      // React event handlers may return promises.
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
    },
  },
  {
    // All configuration is read in one place (SRS 3.6).
    files: ["apps/api/src/**/*.ts"],
    ignores: ["apps/api/src/platform/config.ts", "**/*.test.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "process", property: "env", message: "Read configuration through platform/config.ts." },
      ],
    },
  },
  {
    // Staff data boundary (SRS 11.3, DEC-18): facades tagged @staff-safe return aggregates only.
    files: ["apps/api/src/modules/*/index.ts"],
    plugins: { amar },
    rules: { "amar/staff-safe-facade": "error" },
  },
  {
    // The admin module may import only @staff-safe functions (and types) from other modules.
    files: ["apps/api/src/modules/admin/**/*.ts"],
    ignores: ["**/*.test.ts"],
    plugins: { amar },
    rules: { "amar/admin-imports-only-staff-safe": "error" },
  },
  {
    // Test doubles are loosely typed on purpose.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
