// Prints the SQL that rewrites old emoji category icons to icon ids, generated from EMOJI_TO_ICON so the SQL and
// the TypeScript never drift. Usage: `tsx scripts/gen-icon-migration.ts` (paste into the migration) or
// `tsx scripts/gen-icon-migration.ts --check drizzle/0019_*.sql` to fail when the file lacks the exact statement.
import { readFileSync } from "node:fs";
import { EMOJI_TO_ICON } from "@amar-poribar/shared";

export function iconMigrationSql(): string {
  const whens = Object.entries(EMOJI_TO_ICON)
    .map(([emoji, id]) => `WHEN '${emoji}' THEN '${id}'`)
    .join(" ");
  return `UPDATE "ledger"."categories" SET "icon" = CASE "icon" ${whens} ELSE 'dots' END WHERE "icon" IS NOT NULL AND "icon" NOT IN (${[
    ...new Set(Object.values(EMOJI_TO_ICON)),
    "dots",
  ]
    .map((i) => `'${i}'`)
    .join(", ")});`;
}

const [flag, file] = process.argv.slice(2);
if (flag === "--check" && file) {
  if (!readFileSync(file, "utf8").includes(iconMigrationSql())) {
    console.error(`${file} does not contain the statement generated from EMOJI_TO_ICON`);
    process.exit(1);
  }
} else {
  process.stdout.write(`${iconMigrationSql()}\n`);
}
