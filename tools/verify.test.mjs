import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { MILESTONES, listCommands, runCommands } from "./verify.mjs";

const script = join(dirname(fileURLToPath(import.meta.url)), "verify.mjs");

test("unknown milestone exits 2", () => {
  const res = spawnSync("node", [script, "m99"], { encoding: "utf8" });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /unknown milestone/);
});

test("fails on first failing command", () => {
  const ran = [];
  const exec = (cmd) => {
    ran.push(cmd);
    return cmd === "two" ? 1 : 0;
  };
  const code = runCommands(["one", "two", "three"], { exec, log: () => {} });
  assert.equal(code, 1);
  assert.deepEqual(ran, ["one", "two"]);
});

test("cleanup commands run after a failure", () => {
  const ran = [];
  const exec = (cmd) => (ran.push(cmd), cmd === "up" ? 1 : 0);
  const code = runCommands(["up", "smoke"], { exec, log: () => {}, cleanup: ["down"] });
  assert.equal(code, 1);
  assert.deepEqual(ran, ["up", "down"]);
});

test("lists commands in order", () => {
  const res = spawnSync("node", [script, "--list", "m0"], { encoding: "utf8" });
  assert.equal(res.status, 0);
  const lines = res.stdout.trim().split("\n");
  assert.deepEqual(lines, listCommands("m0"));
  assert.ok(lines.indexOf("pnpm lint") < lines.indexOf("pnpm typecheck"));
  assert.ok(lines.indexOf("pnpm typecheck") < lines.indexOf("pnpm test"));
  assert.ok(lines.indexOf("pnpm test") < lines.indexOf("pnpm stack:up"));
});

test("each milestone includes the previous one", () => {
  for (let n = 1; n <= 8; n++) {
    const prev = listCommands(`m${n - 1}`);
    assert.deepEqual(listCommands(`m${n}`).slice(0, prev.length), prev);
  }
  assert.deepEqual(Object.keys(MILESTONES), ["m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"]);
});
