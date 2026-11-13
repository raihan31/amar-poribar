// Asserts that .github/workflows/ci.yml keeps the web, web-stack and admin jobs (T-WEB-41).
// Usage: node scripts/check-ci-jobs.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const REQUIRED_JOBS = ["web", "web-stack", "admin"];

/** Names of the top-level keys under `jobs:` (no YAML parser dependency needed). */
export function jobNames(yaml) {
  const names = [];
  let inJobs = false;
  for (const line of yaml.split("\n")) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    if (/^\S/.test(line) && !line.startsWith("#")) break;
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (m) names.push(m[1]);
  }
  return names;
}

export function checkCi(yaml) {
  const names = jobNames(yaml);
  return REQUIRED_JOBS.filter((j) => !names.includes(j)).map((j) => `ci.yml is missing job "${j}"`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const yaml = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const problems = checkCi(yaml);
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(`ci.yml has jobs: ${REQUIRED_JOBS.join(", ")}`);
}
