// Usage: node tools/gen-module.mjs <name> [dep,dep] [--root <dir>]
// Creates apps/api/src/modules/<name> with the standard skeleton (SRS §3.2) and registers it.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const rootIdx = args.indexOf("--root");
const rootArg = rootIdx >= 0 ? args.splice(rootIdx, 2)[1] : undefined;
const [name, depsArg = ""] = args;
if (!name || !/^[a-z][a-z0-9]*$/.test(name)) {
  console.error("Usage: gen-module <name> [dep,dep] [--root <dir>]  (name: lowercase letters and digits)");
  process.exit(1);
}
const deps = depsArg ? depsArg.split(",").filter(Boolean) : [];
const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = rootArg ?? join(repo, "apps/api/src");
const dir = join(root, "modules", name);
if (existsSync(dir)) {
  console.error(`modules/${name} already exists`);
  process.exit(1);
}
const Pascal = name[0].toUpperCase() + name.slice(1);
const write = (rel, body) => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), body);
};
for (const sub of ["http", "app", "domain", "infra"]) write(`${sub}/.gitkeep`, "");

write(
  "index.ts",
  `import type { ModuleDefinition } from "../../platform/module.js";
export * from "./events.js";

/** Public surface of the ${name} module. Other modules may import only this file (SRS R1). */
export interface ${Pascal}Facade {
  readonly name: "${name}";
}

declare module "../../platform/module.js" {
  interface Facades {
    ${name}: ${Pascal}Facade;
  }
}

export const ${name}Module: ModuleDefinition<${Pascal}Facade> = {
  name: "${name}",
  dependsOn: ${JSON.stringify(deps)},
  register() {
    return { name: "${name}" };
  },
};
`,
);
write(
  "schema.ts",
  `import { pgSchema } from "drizzle-orm/pg-core";\n\nexport const ${name}Schema = pgSchema("${name}");\n`,
);
write("events.ts", "export {};\n");
write("jobs.ts", "export const jobs: readonly never[] = [];\n");
write(
  `${name}.module.test.ts`,
  `import { describe, expect, it } from "vitest";
import { ${name}Module } from "./index.js";

describe("${name} module", () => {
  it("has the expected name", () => {
    expect(${name}Module.name).toBe("${name}");
  });
});
`,
);

const registry = join(root, "modules", "registry.ts");
if (existsSync(registry)) {
  let s = readFileSync(registry, "utf8");
  s = s.replace("// </imports>", `import { ${name}Module } from "./${name}/index.js";\n// </imports>`);
  s = s.replace("  // </modules>", `  ${name}Module,\n  // </modules>`);
  writeFileSync(registry, s);
}
console.log(`created modules/${name}`);
