// Proves each boundary rule fails on a tiny violating project (SRS AC-42). Run with `pnpm arch:negative`.
import { spawnSync } from "node:child_process";

const cases = [
  ["r1", "no-cross-module-internals"],
  ["r2", "no-circular"],
  ["r4", "module-direction-ledger"],
  ["r7", "domain-pure"],
];
let failed = false;
for (const [dir, rule] of cases) {
  const root = `apps/api/arch-fixtures/${dir}`;
  const res = spawnSync("pnpm", ["exec", "depcruise", root, "--config", ".dependency-cruiser.cjs"], {
    env: { ...process.env, ARCH_ROOT: root },
    encoding: "utf8",
  });
  const out = (res.stdout ?? "") + (res.stderr ?? "");
  const ok = res.status !== 0 && out.includes(rule);
  console.log(`${ok ? "ok  " : "FAIL"} ${dir}: expected rule ${rule} to fail`);
  if (!ok) {
    failed = true;
    console.log(out);
  }
}
process.exit(failed ? 1 : 0);
