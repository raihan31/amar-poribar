import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Ajv } from "ajv";
import { VECTOR_SCHEMAS } from "./response-schemas.js";

const apiDir = new URL("../test-vectors/api/", import.meta.url);
const openapi = JSON.parse(readFileSync(new URL("../../../apps/api/openapi.json", import.meta.url), "utf8")) as {
  paths: Record<string, Record<string, { responses?: Record<string, unknown>; requestBody?: unknown }>>;
  components?: Record<string, unknown>;
};

interface Fixture {
  _operation: string;
  _kind: "request" | "response";
  _status: number;
  body: unknown;
}
const allFiles: string[] = readdirSync(fileURLToPath(apiDir));
const files = allFiles.filter((f: string): boolean => f.endsWith(".json")).sort();
const load = (f: string) => JSON.parse(readFileSync(new URL(f, apiDir), "utf8")) as Fixture;

/** The JSON schema OpenAPI declares for this fixture, when it declares one (it does not for every route yet). */
function openapiSchema(fx: Fixture): unknown {
  const [method, path] = fx._operation.split(" ") as [string, string];
  const op = openapi.paths[path]?.[method.toLowerCase()];
  if (!op) throw new Error(`${fx._operation} is not in apps/api/openapi.json`);
  type Media = { content?: Record<string, { schema?: unknown }> };
  const media = (fx._kind === "request" ? op.requestBody : op.responses?.[String(fx._status)]) as Media | undefined;
  return media?.content?.["application/json"]?.schema;
}

describe("contract vectors", () => {
  it("has one fixture per known shape", () => {
    expect(files).toEqual(
      Object.keys(VECTOR_SCHEMAS)
        .map((n) => `${n}.json`)
        .sort(),
    );
  });

  it.each(files)("every fixture validates against openapi.json and its schema: %s", (file) => {
    const fx = load(file);
    const name = file.replace(/\.json$/, "") as keyof typeof VECTOR_SCHEMAS;
    expect(fx._operation).toMatch(/^(GET|POST|PUT|PATCH|DELETE) \/\S+$/);

    // 1. The operation exists in the committed OpenAPI document; where it has a JSON schema, ajv must accept the body.
    const schema = openapiSchema(fx);
    if (schema) {
      const ajv = new Ajv({ strict: false, allErrors: true });
      const validate = ajv.compile({ ...(schema as object), components: openapi.components });
      expect(validate(fx.body), JSON.stringify(validate.errors)).toBe(true);
    }

    // 2. The Zod schema is the source of truth until routes declare response schemas.
    const result = VECTOR_SCHEMAS[name].safeParse(fx.body);
    expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
  });

  it("fixtures carry only synthetic phone numbers", () => {
    for (const f of files) {
      const phones = JSON.stringify(load(f).body).match(/\+?8801\d{9}/g) ?? [];
      for (const p of phones) expect(p).toMatch(/^\+880170000\d{4}$/);
    }
  });

  it("rejects a draft missing a required field", () => {
    const fx = load("draft.json");
    const broken = { ...(fx.body as Record<string, unknown>) };
    delete broken.confidence;
    expect(VECTOR_SCHEMAS.draft.safeParse(broken).success).toBe(false);
  });
});
