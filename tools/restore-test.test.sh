#!/usr/bin/env bash
# Test for tools/restore-test.sh. Needs a reachable PostgreSQL (PSQL / PG* variables, see the script).
# Writes a tiny plain-SQL dump, runs the script and expects RESTORE_OK; also expects a failure
# when the dump has no tables.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/tiny.sql" <<'SQL'
CREATE SCHEMA ledger;
CREATE TABLE ledger.transactions (id int PRIMARY KEY, amount_paisa bigint NOT NULL);
INSERT INTO ledger.transactions VALUES (1, 50000), (2, 12050);
SQL
out="$(BACKUP_FILE="$TMP/tiny.sql" bash "$HERE/restore-test.sh")"
echo "$out"
echo "$out" | grep -q "^RESTORE_OK$"
echo "$out" | grep -q "rows=2"

echo "SELECT 1;" > "$TMP/empty.sql"
if BACKUP_FILE="$TMP/empty.sql" bash "$HERE/restore-test.sh" >/dev/null 2>&1; then
  echo "expected failure for a dump with no tables" >&2
  exit 1
fi
echo "restore-test.test.sh passed"
