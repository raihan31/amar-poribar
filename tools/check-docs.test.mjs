import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "check-docs.mjs");

const REQUIRED = [
  "docs/BRD.md",
  "docs/SRS.md",
  "docs/runbooks/breach.md",
  "docs/runbooks/restore.md",
  "docs/runbooks/ci.md",
  "tools/check-docs.mjs",
  "tools/check-docs.test.mjs",
  "tools/restore-test.sh",
];

/** Builds a tiny, valid docs tree; `mutate` can change it before the run. */
function fixture(mutate = () => {}) {
  const root = mkdtempSync(join(tmpdir(), "check-docs-"));
  const files = {
    "docs/BRD.md": "| Version | 0.3 — test |\n",
    "docs/SRS.md":
      "#### 5.1.3 Screen catalogue\n\n| Code | Screen | Req. | Mobile / Web / Admin |\n|---|---|---|---|\n| A1 | Login | FR-AUTH-01 | M W |\n\n## 6\n\n| FR-AUTH-01 | Login | M | P1 | A1 |\n\nSee T-ID-01.\n",
    "docs/tasks/01-platform.md": "### T-ID-01 · Login\n- **Closes:** FR-AUTH-01\n",
    "docs/tasks/04-mobile.md": "### T-MOB-14 · A1 Login\n",
  };
  for (const f of REQUIRED) if (!(f in files)) files[f] = "x\n";
  mutate(files);
  for (const [p, body] of Object.entries(files)) {
    if (body === null) continue;
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), body);
  }
  return root;
}

function run(root, ...args) {
  const r = spawnSync(process.execPath, [script, "--root", root, ...args], { encoding: "utf8" });
  return { code: r.status, out: r.stdout + r.stderr };
}

function withFixture(mutate, fn) {
  const root = fixture(mutate);
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("passes on a consistent tree", () => {
  withFixture(undefined, (root) => {
    const r = run(root);
    assert.equal(r.code, 0, r.out);
  });
});

test("reports missing runbook", () => {
  withFixture(
    (f) => (f["docs/runbooks/breach.md"] = null),
    (root) => {
      const r = run(root);
      assert.notEqual(r.code, 0);
      assert.match(r.out, /docs\/runbooks\/breach\.md/);
    },
  );
});

test("reports unknown task id", () => {
  withFixture(
    (f) => (f["docs/SRS.md"] += "\nAlso T-ZZZ-99.\n"),
    (root) => {
      const r = run(root);
      assert.notEqual(r.code, 0);
      assert.match(r.out, /T-ZZZ-99/);
    },
  );
});

test("reports a screen code missing from the mobile and web tasks", () => {
  withFixture(
    (f) => (f["docs/tasks/04-mobile.md"] = "### T-MOB-14 · Login\n"),
    (root) => {
      const r = run(root);
      assert.notEqual(r.code, 0);
      assert.match(r.out, /screen A1/);
    },
  );
});

test("reports a BRD version that is not 0.3", () => {
  withFixture(
    (f) => (f["docs/BRD.md"] = "| Version | 0.2 |\n"),
    (root) => {
      const r = run(root);
      assert.notEqual(r.code, 0);
      assert.match(r.out, /0\.3/);
    },
  );
});

test("FR ids missing from Closes fail only when 05-web-admin.md exists", () => {
  const withoutClose = (f) => (f["docs/tasks/01-platform.md"] = "### T-ID-01 · Login\n");
  withFixture(withoutClose, (root) => {
    const r = run(root);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /FR-AUTH-01/);
  });
  withFixture(
    (f) => {
      withoutClose(f);
      f["docs/tasks/05-web-admin.md"] = "# web\n";
    },
    (root) => {
      const r = run(root);
      assert.notEqual(r.code, 0);
      assert.match(r.out, /FR-AUTH-01/);
    },
  );
});

test("Closes ranges and short forms are expanded", () => {
  withFixture(
    (f) => {
      f["docs/SRS.md"] += "\n| FR-AUTH-02 | b | M | P1 | A1 |\n| FR-AUTH-03 | c | M | P1 | A1 |\n";
      f["docs/tasks/01-platform.md"] = "### T-ID-01 · Login\n- **Closes:** FR-AUTH-01..02, -03\n";
      f["docs/tasks/05-web-admin.md"] = "# web\n";
    },
    (root) => {
      const r = run(root);
      assert.equal(r.code, 0, r.out);
    },
  );
});

test("warn mode exits 0", () => {
  withFixture(
    (f) => {
      f["docs/runbooks/ci.md"] = null;
      f["docs/BRD.md"] = "| Version | 0.2 |\n";
    },
    (root) => {
      const r = run(root, "--warn");
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /ci\.md/);
    },
  );
});
