// Progress ledger for docs/tasks/PROGRESS.md.
//   node tools/orchestrate/progress.mjs init            create the file from graph.json (all todo)
//   node tools/orchestrate/progress.mjs set <ID> <todo|doing|done|blocked> [sha] [note]
//   node tools/orchestrate/progress.mjs show            print counts per milestone
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const file = join(root, "docs/tasks/PROGRESS.md");
const graph = JSON.parse(readFileSync(join(root, "tools/orchestrate/graph.json"), "utf8"));
const STATUS = ["todo", "doing", "done", "blocked"];
const today = () => new Date().toISOString().slice(0, 10);

export function readProgress() {
  const map = new Map();
  if (!existsSync(file)) return map;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(
      /^\| (T-[A-Z]+-\d+[A-Z]?) \| M(\d) \| (todo|doing|done|blocked) \| ([^|]*)\| ([^|]*)\| ([^|]*)\|/,
    );
    if (m) map.set(m[1], { status: m[3], sha: m[4].trim(), date: m[5].trim(), note: m[6].trim() });
  }
  return map;
}

function write(map) {
  const lines = [
    "# Task progress",
    "",
    "Maintained by `tools/orchestrate/progress.mjs`. Status: todo, doing, done (acceptance commands passed), blocked (see note).",
    "",
    "| Task | M | Status | Commit | Date | Note |",
    "|---|---|---|---|---|---|",
  ];
  for (const t of graph) {
    const r = map.get(t.id) ?? { status: "todo", sha: "", date: "", note: "" };
    lines.push(`| ${t.id} | M${t.ms} | ${r.status} | ${r.sha} | ${r.date} | ${r.note.replace(/\|/g, "/")} |`);
  }
  writeFileSync(file, lines.join("\n") + "\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, id, status, sha = "", ...note] = process.argv.slice(2);
  if (cmd === "init") {
    const map = readProgress();
    write(map);
  } else if (cmd === "set") {
    if (!graph.some((t) => t.id === id) || !STATUS.includes(status)) {
      console.error("usage: set <TASK-ID> <todo|doing|done|blocked> [sha] [note]");
      process.exit(1);
    }
    const map = readProgress();
    map.set(id, { status, sha: sha.slice(0, 9), date: today(), note: note.join(" ") });
    write(map);
  } else if (cmd === "show") {
    const map = readProgress();
    const by = {};
    for (const t of graph) {
      const s = map.get(t.id)?.status ?? "todo";
      by[`M${t.ms}`] ??= { todo: 0, doing: 0, done: 0, blocked: 0 };
      by[`M${t.ms}`][s]++;
    }
    console.log(JSON.stringify(by, null, 1));
  } else {
    console.error("usage: init | set | show");
    process.exit(1);
  }
}
