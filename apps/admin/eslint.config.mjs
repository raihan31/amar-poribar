import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const config = [
  { ignores: [".next/**", "node_modules/**", "coverage/**", "next-env.d.ts", "lib/api/schema.d.ts"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // eslint-config-next already registers the jsx-a11y plugin; only add the recommended rules.
    rules: {
      ...jsxA11y.configs.recommended.rules,
      "jsx-a11y/no-static-element-interactions": "error",
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "Staff tokens must not live in browser storage." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "localStorage", message: "Staff tokens must not live in browser storage." },
      ],
    },
  },
  {
    // Private family fields may be used in tests only, never in UI components.
    files: ["components/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@amar-poribar/shared/private-fields", "@amar-poribar/shared/private-fields/*"],
              message: "Private fields are for tests only.",
            },
          ],
        },
      ],
    },
  },
];

export default config;
