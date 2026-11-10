// Extracts every Bangla UI string from the design boards into docs/design/strings.json.
// Usage: node tools/design/extract-strings.mjs          (write)
//        node tools/design/extract-strings.mjs --check  (exit 1 if the file is out of date)
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = join(root, "docs/design/screens");
const out = join(root, "docs/design/strings.json");
const canvas = JSON.parse(readFileSync(join(root, "docs/design/canvas.json"), "utf8"));

const BN = /[ঀ-৿][ঀ-৿ ,।:?\-’'"‌‍()০-৯.%/+·…]*/g;
const NAMES = ["আম্মু", "আব্বু", "দাদি", "তানভীর", "করিম চাচা", "শাথী", "রহিম পরিবার", "দাদা-দাদির বাড়ি"];
const isDynamic = (s) => /[০-৯৳]/.test(s) || NAMES.some((n) => s.includes(n));

const screens = {};
for (const file of readdirSync(dir).filter((f) => f.endsWith(".dc.html")).sort()) {
  if (file.startsWith("Admin")) continue; // admin console is English only
  if (!canvas.boards[file]) continue; // not on the canvas
  let html = readFileSync(join(dir, file), "utf8");
  html = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, " ").replace(/<title>[\s\S]*?<\/title>/g, " ");
  const texts = [];
  for (const m of html.matchAll(/>([^<>]+)</g)) texts.push(m[1].trim());
  for (const m of html.matchAll(/aria-label="([^"]+)"/g)) texts.push(m[1]);
  const found = new Set();
  for (const t of texts) for (const s of t.match(BN) ?? []) {
    const v = s.trim().replace(/^[ ,।:?\-]+|[ ,।:?\-]+$/g, "");
    if (v.length >= 3) found.add(v);
  }
  const all = [...found].sort();
  screens[file.replace(".dc.html", "")] = {
    code: canvas.boards[file].title.split(" ·")[0],
    static: all.filter((s) => !isDynamic(s)),
    dynamic: all.filter(isDynamic),
  };
}
const json = JSON.stringify({ generatedBy: "tools/design/extract-strings.mjs", screens }, null, 2) + "\n";
if (process.argv.includes("--check")) {
  const cur = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (cur !== json) { console.error("docs/design/strings.json is out of date; run node tools/design/extract-strings.mjs"); process.exit(1); }
  console.log("design strings up to date");
} else { writeFileSync(out, json); console.log("wrote", out); }
