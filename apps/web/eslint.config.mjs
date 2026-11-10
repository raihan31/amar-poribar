import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const config = [
  { ignores: [".next/**", "node_modules/**", "coverage/**", "next-env.d.ts"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // eslint-config-next already registers the jsx-a11y plugin; only add the recommended rules.
    rules: {
      ...jsxA11y.configs.recommended.rules,
      "jsx-a11y/no-static-element-interactions": "error",
      // Pre-existing page code predates the harness; tighten after the T-WEB-02 refactor.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/lib/api/legacy", "@/lib/api/legacy/*"], message: "Use the typed API client." }] },
      ],
      "no-restricted-globals": ["warn", { name: "localStorage", message: "Tokens must not live in localStorage." }],
      "no-restricted-properties": [
        "warn",
        { object: "window", property: "localStorage", message: "Tokens must not live in localStorage." },
      ],
    },
  },
];

export default config;
