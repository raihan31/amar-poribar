import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRIVATE_FIELDS } from "../../../../packages/shared/src/private-fields";
import { SENTINELS, sentinelForms } from "../../e2e/helpers/sentinels";

const root = join(__dirname, "..", "..");
const schemaPath = join(__dirname, "schema.d.ts");

const PROP = /^\s*"?([A-Za-z_][\w-]*)"?\??:/gm;

/** Property names declared under every `/admin/v1` path and in the component schemas those paths reference. */
function adminPropertyNames(schema: string): Set<string> {
  const names = new Set<string>();
  const blocks: string[] = [];
  let current: string[] | null = null;
  for (const line of schema.split("\n")) {
    const m = /^ {4}"([^"]+)": \{/.exec(line);
    if (m) {
      current = m[1]!.startsWith("/admin/v1") ? [] : null;
      if (current) blocks.push("");
    } else if (/^\}/.test(line)) {
      current = null;
    }
    if (current) blocks[blocks.length - 1] += `${line}\n`;
  }
  const body = blocks.join("\n");
  for (const m of body.matchAll(PROP)) names.add(m[1]!);
  const refs = new Set([...body.matchAll(/components\["schemas"\]\["(\w+)"\]/g)].map((m) => m[1]!));
  for (const ref of refs) {
    const start = schema.indexOf(`        ${ref}: {`);
    if (start < 0) continue;
    const end = schema.indexOf("\n        };", start);
    const chunk = schema.slice(start, end < 0 ? undefined : end);
    for (const m of chunk.matchAll(PROP)) names.add(m[1]!);
  }
  return names;
}

function leaks(schema: string): string[] {
  const used = adminPropertyNames(schema);
  return PRIVATE_FIELDS.filter((f) => used.has(f));
}

describe("admin schema private fields", () => {
  it("no /admin/v1 response type has a private field", () => {
    expect(leaks(readFileSync(schemaPath, "utf8"))).toEqual([]);
  });

  it("fails when a private property is added to an admin response type (negative, in memory)", () => {
    const patched = `${readFileSync(schemaPath, "utf8")}
export interface paths {
    "/admin/v1/families/{id}": {
        get: {
            responses: {
                200: {
                    content: {
                        "application/json": {
                            name: string;
                            note: string;
                        };
                    };
                };
            };
        };
    };
}
`;
    expect(leaks(patched)).toContain("note");
  });

  it("detects a private property reached through a component schema", () => {
    const schema = `export interface paths {
    "/admin/v1/x": {
        get: { responses: { 200: { content: { "application/json": components["schemas"]["Row"]; }; }; }; };
    };
}
export interface components {
    schemas: {
        Row: {
            id: string;
            phone: string;
        };
    };
}
`;
    expect(leaks(schema)).toEqual(["phone"]);
  });
});

describe("sentinels helper", () => {
  it("lists the seven distinctive values", () => {
    expect(Object.values(SENTINELS)).toHaveLength(7);
    expect(SENTINELS.phone).toBe("+8801799900011");
  });

  it("produces plain, URL-encoded and base64 forms", () => {
    const forms = sentinelForms("+8801799900011");
    expect(forms).toContain("+8801799900011");
    expect(forms).toContain(encodeURIComponent("+8801799900011"));
    expect(forms).toContain(Buffer.from("+8801799900011").toString("base64"));
  });
});

/**
 * Names that are also ordinary words in the console: request `body`, a health incident `note`,
 * a staff member's own `email`, and the session `token`. The schema test above still covers all of them.
 */
const STAFF_OWN_WORDS = new Set<string>(["body", "note", "email", "token"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("components never reference private field names", () => {
  it("no UI file references a private field as a property, key or import", () => {
    const hits: string[] = [];
    const files = [...walk(join(root, "components")), ...walk(join(root, "app"))].filter((f) => !/test-utils/.test(f));
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (/private-fields/.test(src)) hits.push(`${file}: imports private-fields`);
      for (const f of PRIVATE_FIELDS.filter((x) => !STAFF_OWN_WORDS.has(x))) {
        const re = new RegExp(`(\\.${f}\\b|\\b${f}\\s*[:?]|\\["${f}"\\])`);
        if (re.test(src)) hits.push(`${file}: ${f}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
