import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apiRoot, buildOpenApiDocument, countUndocumented, serialize } from "../src/platform/openapi/build.js";

/** Writes (or with --check, verifies) `openapi.json`; `--dir <path>` targets another folder (tests). */
const args = process.argv.slice(2);
const check = args.includes("--check");
const dirIdx = args.indexOf("--dir");
const dir = dirIdx >= 0 ? args[dirIdx + 1]! : apiRoot;
const file = join(dir, "openapi.json");
const baselineFile = join(dir, "openapi-baseline.json");

const doc = await buildOpenApiDocument();
const text = serialize(doc);
const undocumented = countUndocumented(doc);
process.stdout.write(`openapi: ${Object.keys(doc.paths).length} paths, x-undocumented operations: ${undocumented}\n`);

const baseline = existsSync(baselineFile)
  ? (JSON.parse(readFileSync(baselineFile, "utf8")) as { undocumented: number }).undocumented
  : undefined;
if (baseline !== undefined && undocumented > baseline) {
  console.error(
    `openapi: undocumented routes rose from ${baseline} to ${undocumented}; give new routes response schemas`,
  );
  process.exit(1);
}

if (check) {
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (current !== text) {
    const tmp = mkdtempSync(join(tmpdir(), "openapi-"));
    const generated = join(tmp, "openapi.generated.json");
    writeFileSync(generated, text);
    const diff = spawnSync("diff", ["-u", file, generated], { encoding: "utf8" });
    console.error(diff.stdout || "openapi.json is missing");
    rmSync(tmp, { recursive: true, force: true });
    console.error("openapi.json is out of date. Run: pnpm --filter @amar-poribar/api openapi:build");
    process.exit(1);
  }
  process.stdout.write("openapi.json is up to date\n");
} else {
  writeFileSync(file, text);
  if (baseline === undefined || undocumented < baseline) {
    writeFileSync(baselineFile, JSON.stringify({ undocumented }, null, 2) + "\n");
  }
  process.stdout.write(`wrote ${file}\n`);
}
