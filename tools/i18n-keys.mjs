// Usage: node tools/i18n-keys.mjs [--root <repo dir>]
// Compares packages/shared/src/i18n/{bn,en}.ts and apps/mobile/lib/l10n/app_{bn,en}.arb,
// and scans apps/web and apps/admin sources for t("...") literals that are not in the catalogue.
// Missing keys fail (exit 1); unused keys are warnings.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const rootIdx = args.indexOf("--root");
const root = rootIdx >= 0 ? args[rootIdx + 1] : join(dirname(fileURLToPath(import.meta.url)), "..");

const read = (p) => readFileSync(join(root, p), "utf8");
const exists = (p) => existsSync(join(root, p));

/** Top-level keys of a catalogue object literal: lines indented by exactly two spaces. */
function tsKeys(text) {
  const keys = new Set();
  for (const m of text.matchAll(/^ {2}(?:"([^"]+)"|([A-Za-z_$][\w$]*))\s*:/gm)) keys.add(m[1] ?? m[2]);
  return keys;
}

function arbKeys(text) {
  return new Set(Object.keys(JSON.parse(text)).filter((k) => !k.startsWith("@")));
}

function diff(aName, a, bName, b, errors) {
  for (const k of a) if (!b.has(k)) errors.push(`${k}: in ${aName} but missing from ${bName}`);
  for (const k of b) if (!a.has(k)) errors.push(`${k}: in ${bName} but missing from ${aName}`);
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "dist" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts")) yield p;
  }
}

export function check(rootDir = root) {
  const errors = [];
  const warnings = [];
  const bnPath = "packages/shared/src/i18n/bn.ts";
  const enPath = "packages/shared/src/i18n/en.ts";
  if (!exists(bnPath) || !exists(enPath)) {
    errors.push(`${bnPath} or ${enPath} not found`);
    return { errors, warnings };
  }
  const bn = tsKeys(read(bnPath));
  const en = tsKeys(read(enPath));
  diff("bn.ts", bn, "en.ts", en, errors);

  const arbBn = "apps/mobile/lib/l10n/app_bn.arb";
  const arbEn = "apps/mobile/lib/l10n/app_en.arb";
  if (exists(arbBn) && exists(arbEn))
    diff("app_bn.arb", arbKeys(read(arbBn)), "app_en.arb", arbKeys(read(arbEn)), errors);

  const used = new Set();
  for (const app of ["apps/web", "apps/admin"]) {
    const dir = join(rootDir, app);
    if (!existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/(?<![\w$.])t\(\s*["']([^"']+)["']/g)) {
        used.add(m[1]);
        if (!bn.has(m[1])) errors.push(`${m[1]}: used in ${file.slice(rootDir.length + 1)} but not in bn.ts`);
      }
    }
  }
  for (const k of bn)
    if (!used.has(k) && !k.startsWith("error.")) warnings.push(`${k}: not used by apps/web or apps/admin`);
  return { errors, warnings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { errors, warnings } = check(root);
  for (const w of warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  if (errors.length) {
    console.error(`i18n:check failed with ${errors.length} problem(s)`);
    process.exit(1);
  }
  console.log(`i18n:check ok (${warnings.length} warning(s))`);
}
