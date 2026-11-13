import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { jobNames, checkCi, REQUIRED_JOBS } from "./check-ci-jobs.mjs";

const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

test("ci.yml declares the web, web-stack and admin jobs", () => {
  const names = jobNames(ci);
  for (const job of REQUIRED_JOBS) assert.ok(names.includes(job), `missing job ${job}`);
  assert.deepEqual(checkCi(ci), []);
});

test("a workflow without the jobs is reported", () => {
  const problems = checkCi("jobs:\n  web:\n    runs-on: x\n");
  assert.ok(problems.some((p) => p.includes("web-stack")));
  assert.ok(problems.some((p) => p.includes("admin")));
});

test("jobNames reads only top-level job keys", () => {
  assert.deepEqual(jobNames("name: x\njobs:\n  a:\n    steps:\n      - run: b:\n  c:\n    x: 1\nother:\n  z: 1\n"), [
    "a",
    "c",
  ]);
});
