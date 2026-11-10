// Drift check: fails if `drizzle-kit generate` would produce a new migration, i.e. a schema.ts
// change has no committed migration. Runs against a temp copy of ./drizzle, leaving it untouched.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const tmp = mkdtempSync(join(tmpdir(), "drizzle-drift-"));
const out = join(tmp, "drizzle");
if (existsSync(join(root, "drizzle"))) cpSync(join(root, "drizzle"), out, { recursive: true });
const cfg = join(root, "drizzle.drift.config.ts");
writeFileSync(
  cfg,
  readFileSync(join(root, "drizzle.config.ts"), "utf8").replace('out: "./drizzle"', `out: ${JSON.stringify(out)}`),
);
const sqlFiles = () => readdirSync(out).filter((f) => f.endsWith(".sql"));
let code = 0;
try {
  const before = new Set(sqlFiles());
  const r = spawnSync("pnpm", ["exec", "drizzle-kit", "generate", "--config", cfg, "--name", "drift"], {
    cwd: root,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(r.stdout, r.stderr);
    code = r.status ?? 1;
  } else {
    const added = sqlFiles().filter((f) => !before.has(f));
    const nonEmpty = added.filter((f) => readFileSync(join(out, f), "utf8").trim() !== "");
    if (nonEmpty.length > 0) {
      console.error(`Schema drift: run \`pnpm db:generate\` and commit the result. Would add: ${nonEmpty.join(", ")}`);
      code = 1;
    } else console.log("no schema drift");
  }
} finally {
  rmSync(cfg, { force: true });
  rmSync(tmp, { recursive: true, force: true });
}
process.exit(code);
