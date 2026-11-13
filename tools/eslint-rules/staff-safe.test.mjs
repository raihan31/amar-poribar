import { RuleTester } from "eslint";
import { describe, it } from "node:test";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "node:url";
import plugin from "./staff-safe.mjs";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const root = fileURLToPath(new URL("./fixtures", import.meta.url));
const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    // CI=true makes typescript-estree use single-run mode, which builds a program without the
    // default libs (Promise, Array unresolved). Opt out so the tests behave the same everywhere.
    parserOptions: { project: "./tsconfig.json", tsconfigRootDir: root, disallowAutomaticSingleRunInference: true },
  },
});
const facade = `${root}/modules/billing/index.ts`;
const adminFile = `${root}/modules/admin/file.ts`;

tester.run("staff-safe-facade", plugin.rules["staff-safe-facade"], {
  valid: [
    {
      name: "passes aggregate dto",
      filename: facade,
      code: `
        export interface Summary { familyCount: number; totals: { members: number; plan: string } }
        /** @staff-safe */
        export async function summary(): Promise<Summary[]> { return []; }`,
    },
    {
      name: "untagged functions are not checked",
      filename: facade,
      code: `export function raw(): { note: string } { return { note: "x" }; }`,
    },
  ],
  invalid: [
    {
      name: "fails when return type exposes amountPaisa",
      filename: facade,
      code: `/** @staff-safe */
        export function total(): { amountPaisa: number } { return { amountPaisa: 1 }; }`,
      errors: [{ messageId: "privateField", data: { fn: "total", name: "amountPaisa" } }],
    },
    {
      name: "fails on nested note",
      filename: facade,
      code: `/** @staff-safe */
        export async function list(): Promise<{ rows: { id: string; detail: { note: string } }[] }> { return { rows: [] }; }`,
      errors: [{ messageId: "privateField", data: { fn: "list", name: "note" } }],
    },
    {
      name: "fails on any",
      filename: facade,
      code: `/** @staff-safe */
        export function loose(): { data: any } { return { data: 1 }; }`,
      errors: [{ messageId: "anyType" }],
    },
    {
      name: "fails on missing return type",
      filename: facade,
      code: `/** @staff-safe */
        export function inferred() { return { n: 1 }; }`,
      errors: [{ messageId: "noReturnType" }],
    },
    {
      name: "fails on tagged interface method",
      filename: facade,
      code: `export interface F {
          /** @staff-safe */
          get(): Promise<{ phone: string }>;
        }`,
      errors: [{ messageId: "privateField", data: { fn: "get", name: "phone" } }],
    },
  ],
});

tester.run("admin-imports-only-staff-safe", plugin.rules["admin-imports-only-staff-safe"], {
  valid: [
    {
      name: "admin importing a tagged function and a type passes",
      filename: adminFile,
      code: `import { tagged, type T } from "../families/index.ts"; void tagged; export type U = T;`,
    },
  ],
  invalid: [
    {
      name: "admin importing an untagged function is reported",
      filename: adminFile,
      code: `import { untagged } from "../families/index.ts"; void untagged;`,
      errors: [{ messageId: "untagged", data: { name: "untagged" } }],
    },
  ],
});
