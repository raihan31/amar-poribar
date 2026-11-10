// Picks the next wave of tasks for a milestone (see docs/task-goal.md).
//   node tools/orchestrate/plan.mjs <milestone> [maxWave=6]
// Prints JSON: { milestone, wave:[{id,title,layer,doc,files}], waiting:[], blocked:[], done, total, complete }
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readProgress } from "./progress.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const graph = JSON.parse(readFileSync(join(root, "tools/orchestrate/graph.json"), "utf8"));
const N = Number(process.argv[2]);
const MAX = Number(process.argv[3] ?? 6);
const progress = readProgress();
const status = (id) => progress.get(id)?.status ?? "todo";
const byId = new Map(graph.map((t) => [t.id, t]));

// Candidates: tasks of milestone N plus any later task a candidate depends on (pulled forward).
const cand = new Set(graph.filter((t) => t.ms === N).map((t) => t.id));
const queue = [...cand];
while (queue.length) {
  for (const d of byId.get(queue.pop()).deps) {
    if (!cand.has(d) && status(d) !== "done") { cand.add(d); queue.push(d); }
  }
}
const pending = [...cand].filter((id) => status(id) !== "done");
const blocked = new Set(pending.filter((id) => status(id) === "blocked"));

// A task is waiting when a dependency is not done (and not itself runnable now).
const depsDone = (t) => t.deps.every((d) => status(d) === "done");
const downstream = (id, seen = new Set()) => {
  for (const t of graph) if (t.deps.includes(id) && !seen.has(t.id)) { seen.add(t.id); downstream(t.id, seen); }
  return seen;
};
const weight = new Map(pending.map((id) => [id, downstream(id).size]));
const unreachable = pending.filter((id) => status(id) !== "blocked" && !depsDone(byId.get(id)) && hasBlockedAncestor(id));
function hasBlockedAncestor(id, seen = new Set()) {
  for (const d of byId.get(id).deps) {
    if (seen.has(d)) continue;
    seen.add(d);
    if (status(d) === "blocked" || hasBlockedAncestor(d, seen)) return true;
  }
  return false;
}

const ready = pending
  .filter((id) => status(id) === "todo" || status(id) === "doing")
  .map((id) => byId.get(id))
  .filter(depsDone)
  .sort((a, b) => weight.get(b.id) - weight.get(a.id) || a.ms - b.ms || a.id.localeCompare(b.id));

const HOT = [
  ["migrations", /(\/migrations\/|\/drizzle\/|\.sql$)/],
  ["registry", /modules\/registry\.ts$/],
  ["root-package", /^package\.json$/],
  ["compose", /docker-compose\.yml$|^Dockerfile$/],
  ["ci", /\.github\/workflows\//],
  ["openapi", /openapi\.json$/],
  ["drift", /(database\/(tables|database)\.dart|drift_schemas\/)/],
  ["app-ts", /apps\/api\/src\/app\.ts$/],
  ["eslint", /eslint\.config\.mjs$/],
];
const hotOf = (t) => new Set(t.files.flatMap((f) => HOT.filter(([, re]) => re.test(f)).map(([k]) => k)));
const overlap = (a, b) => a === b || a.startsWith(b.endsWith("/") ? b : b + "/") || b.startsWith(a.endsWith("/") ? a : a + "/");

const wave = [];
const hotTaken = new Set();
for (const t of ready) {
  if (wave.length >= MAX) break;
  const hot = hotOf(t);
  if ([...hot].some((h) => hotTaken.has(h))) continue;
  if (wave.some((w) => w.files.some((a) => t.files.some((b) => overlap(a, b))))) continue;
  wave.push(t);
  hot.forEach((h) => hotTaken.add(h));
}

console.log(
  JSON.stringify(
    {
      milestone: N,
      wave: wave.map(({ id, title, layer, doc, files }) => ({ id, title, layer, doc, files })),
      readyNotChosen: ready.length - wave.length,
      waiting: pending.filter((id) => status(id) === "todo" && !depsDone(byId.get(id)) && !unreachable.includes(id)).length,
      unreachable,
      blocked: [...blocked],
      done: [...cand].filter((id) => status(id) === "done").length,
      total: cand.size,
      complete: pending.length === 0,
    },
    null,
    1,
  ),
);
