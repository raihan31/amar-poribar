// Documentation consistency checker (T-PLAT-34).
// Usage: node tools/check-docs.mjs [--warn] [--root <dir>]
// Checks: (a) required files exist; (b) every FR id defined in docs/SRS.md is closed by a task;
// (c) every T-... id referenced in the SRS is a heading in docs/tasks; (d) every screen code in
// SRS 5.1.3 is mentioned in the mobile or web/admin task files; (e) the BRD version line has 0.3.
// Check (b) is only fatal once docs/tasks/05-web-admin.md exists. --warn prints and exits 0.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const warnOnly = args.includes("--warn");
const rootIdx = args.indexOf("--root");
const root = rootIdx >= 0 ? args[rootIdx + 1] : join(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_FILES = [
  "docs/BRD.md",
  "docs/SRS.md",
  "docs/runbooks/breach.md",
  "docs/runbooks/restore.md",
  "docs/runbooks/ci.md",
  "tools/check-docs.mjs",
  "tools/check-docs.test.mjs",
  "tools/restore-test.sh",
];

const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "");
const pad = (n, width) => String(n).padStart(width, "0");

const hard = []; // always fatal (unless --warn)
const soft = []; // fatal only in strict mode for (b)

// (a) files
for (const f of REQUIRED_FILES) if (!existsSync(join(root, f))) hard.push(`missing file: ${f}`);

const srs = read("docs/SRS.md");
const taskDir = join(root, "docs/tasks");
const taskFiles = existsSync(taskDir) ? readdirSync(taskDir).filter((f) => /^\d\d-.*\.md$/.test(f)) : [];
const tasks = Object.fromEntries(taskFiles.map((f) => [f, read(`docs/tasks/${f}`)]));
const allTasks = Object.values(tasks).join("\n");

// (b) FR ids defined in SRS tables vs ids closed by tasks
const defined = new Set([...srs.matchAll(/^\|\s*(FR-[A-Z0-9]+-\d+)\s*\|/gm)].map((m) => m[1]));

/** Expands "FR-X-01..03, -05, FR-Y" style text into [exact ids, family prefixes]. */
function expandCloses(text) {
  const ids = new Set();
  const prefixes = new Set();
  let family = "";
  let width = 2;
  const re = /(FR-[A-Z0-9]+)(?:-(\d+))?(?:\.\.(?:FR-[A-Z0-9]+-)?(\d+))?|(?<![\w-])-(\d+)(?:\.\.(\d+))?/g;
  for (const m of text.matchAll(re)) {
    let from;
    let to;
    if (m[1]) {
      family = m[1];
      if (m[2] === undefined) {
        prefixes.add(family);
        continue;
      }
      width = m[2].length;
      from = Number(m[2]);
      to = m[3] ? Number(m[3]) : from;
    } else if (family) {
      from = Number(m[4]);
      to = m[5] ? Number(m[5]) : from;
    } else continue;
    for (let n = from; n <= to; n++) ids.add(`${family}-${pad(n, width)}`);
  }
  return { ids, prefixes };
}

const closed = new Set();
const closedPrefixes = new Set();
const closesText = [...allTasks.matchAll(/\*\*Closes:\*\*([^\n]*)/g)].map((m) => m[1]).join("\n");
const exp = expandCloses(closesText);
exp.ids.forEach((i) => closed.add(i));
exp.prefixes.forEach((p) => closedPrefixes.add(p));

// The task README lists requirements covered without their own task.
const readme = read("docs/tasks/README.md");
const noTask = readme.split("## Requirements without their own task")[1] ?? "";
const exp2 = expandCloses(noTask);
exp2.ids.forEach((i) => closed.add(i));
exp2.prefixes.forEach((p) => closedPrefixes.add(p));

const missingFr = [...defined].filter((id) => !closed.has(id) && !closedPrefixes.has(id.replace(/-\d+$/, "")));
for (const id of missingFr) soft.push(`${id} is not in any task "Closes:" line`);

// (c) T-... ids referenced in SRS exist as task headings
const headings = new Set([...allTasks.matchAll(/^#{2,4}\s+(T-[A-Z]+-\d+[A-Z]?)\b/gm)].map((m) => m[1]));
const referenced = new Set(srs.match(/\bT-[A-Z]+-\d+[A-Z]?\b/g) ?? []);
for (const id of [...referenced].sort()) {
  if (!headings.has(id) && !headings.has(id.replace(/[A-Z]$/, "")))
    hard.push(`SRS references ${id} but no task heading has it`);
}

// (d) screen codes from SRS 5.1.3
const section = (srs.split("#### 5.1.3")[1] ?? "").split(/\n#{2,4} /)[0];
const screenText = `${tasks["04-mobile.md"] ?? ""}\n${tasks["05-web-admin.md"] ?? ""}`;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const row of section.split("\n")) {
  const cells = row.split("|").map((c) => c.trim());
  if (cells.length < 4 || !cells[1] || cells[1] === "Code" || /^-+$/.test(cells[1])) continue;
  const codeCell = cells[1];
  const parts = codeCell.split(/[\s/()]+/).filter(Boolean);
  const words = parts.filter((t) => !/^\d+$/.test(t));
  const numbers = parts.filter((t) => /^\d+$/.test(t));
  const word = (t) => new RegExp(`(?<![\\w-])${escapeRe(t)}(?![\\w-])`).test(screenText);
  // Purely numeric codes are matched as "screen N" or as the first cell of a table row.
  const numeric = (n) => new RegExp(`screen ${n}\\b|^\\|\\s*${n}\\s*[|/]`, "im").test(screenText);
  const found = words.length ? words.some(word) : numbers.some(numeric);
  if (!found) hard.push(`screen ${codeCell} (${cells[2]}) is not mentioned in 04-mobile.md or 05-web-admin.md`);
}

// (e) BRD version
const versionLine = read("docs/BRD.md")
  .split("\n")
  .find((l) => /^\|\s*Version\s*\|/.test(l));
if (!versionLine || !/0\.3/.test(versionLine)) hard.push("BRD version line must contain 0.3");

const strict = existsSync(join(taskDir, "05-web-admin.md"));
const fatal = warnOnly ? [] : strict ? [...hard, ...soft] : hard;
const warnings = warnOnly ? [...hard, ...soft] : strict ? [] : soft;

for (const w of warnings) console.warn(`warn: ${w}`);
for (const e of fatal) console.error(`error: ${e}`);
if (warnOnly && (hard.length || soft.length))
  console.warn(`(--warn) ${hard.length + soft.length} problem(s) not failing the run`);
if (fatal.length) {
  console.error(`check-docs failed: ${fatal.length} problem(s)`);
  process.exit(1);
}
console.log(`check-docs ok${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
