// Milestone runner: `node tools/verify.mjs mN` (also `pnpm verify:mN`). SRS 13.1.
// Runs the commands of milestone N in order and exits non-zero at the first failure.
// `--list mN` prints the commands without running them.
// Later task files append to ADDED when they add acceptance tests (tagged with their AC id).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Same set as the CI jobs ts-static, ts-test, build and stack.
const M0 = [
  "pnpm install --frozen-lockfile",
  "pnpm lint",
  "pnpm format:check",
  "pnpm typecheck",
  "pnpm arch",
  "pnpm arch:negative",
  "pnpm openapi:check",
  "pnpm db:check",
  "pnpm exec tsx tools/gen-vectors.ts --check",
  "node --test tools/eslint-rules/*.test.mjs",
  "node --test tools/verify.test.mjs",
  "node tools/check-docs.mjs --warn",
  "pnpm no-drizzle-push",
  "pnpm test",
  "pnpm test:db",
  "pnpm coverage",
  "pnpm build",
  "pnpm stack:up",
  "bash tools/smoke.sh",
];

// Commands that run after the list finishes or fails.
const CLEANUP = ["pnpm stack:down"];

/** Test ids are tagged `AC-nn` in the test title, e.g. it("AC-12 otp limits ..."). */
function ac(from, to) {
  const ids = [];
  for (let n = from; n <= to; n++) ids.push(String(n).padStart(2, "0"));
  return `pnpm test:db -- -t "AC-(${ids.join("|")})"`;
}

/** Per milestone: the commands it adds on top of the previous one. */
const ADDED = {
  m0: M0,
  m1: ["pnpm mobile:analyze", "pnpm mobile:test"],
  m2: [ac(1, 14)],
  m3: [ac(15, 22)],
  m4: [ac(23, 26)],
  m5: [ac(27, 31)],
  m6: [ac(32, 34)],
  m7: [ac(35, 38)],
  m8: [ac(39, 41)],
};

export const MILESTONES = {};
{
  let acc = [];
  for (const [name, added] of Object.entries(ADDED)) {
    acc = [...acc, ...added.filter((c) => !acc.includes(c))];
    MILESTONES[name] = acc;
  }
}

export function listCommands(name) {
  return Object.hasOwn(MILESTONES, name) ? MILESTONES[name] : null;
}

function shell(cmd) {
  return spawnSync(cmd, { shell: true, stdio: "inherit" }).status ?? 1;
}

/** Runs commands sequentially; returns 0, or the exit code of the first failure. */
export function runCommands(commands, { exec = shell, log = console.log, cleanup = [] } = {}) {
  let code = 0;
  try {
    for (const cmd of commands) {
      log(`\n$ ${cmd}`);
      const t0 = Date.now();
      const status = exec(cmd);
      log(`${status === 0 ? "ok" : "FAILED"} (${((Date.now() - t0) / 1000).toFixed(1)}s): ${cmd}`);
      if (status !== 0) {
        code = status;
        break;
      }
    }
  } finally {
    for (const cmd of cleanup) exec(cmd);
  }
  return code;
}

function main(argv) {
  const list = argv[0] === "--list";
  const name = list ? argv[1] : argv[0];
  const commands = listCommands(name);
  if (!commands) {
    console.error(`unknown milestone: ${name ?? "(none)"} (expected ${Object.keys(MILESTONES).join(", ")})`);
    return 2;
  }
  if (list) {
    console.log(commands.join("\n"));
    return 0;
  }
  const code = runCommands(commands, { cleanup: CLEANUP });
  console.log(code === 0 ? `\nverify ${name}: OK` : `\nverify ${name}: FAILED`);
  return code;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
