#!/usr/bin/env bash
# Restore test (NFR-08, docs/runbooks/restore.md).
# Creates a scratch database, restores the latest pg_dump into it, runs a row-count sanity
# query, drops the scratch database and prints RESTORE_OK.
#
#   BACKUP_FILE   path to a dump, or a directory (the newest file in it is used). Required.
#                 A custom-format dump (starts with PGDMP) is restored with pg_restore,
#                 anything else is treated as plain SQL and piped to psql.
#   PSQL          psql command, default "psql". It may carry a prefix and connection flags,
#                 for example "docker exec -i pg psql -U amar". Without flags, the standard
#                 PGHOST, PGPORT, PGUSER and PGPASSWORD variables apply.
#   PG_RESTORE    pg_restore command, default "pg_restore" (same idea as PSQL)
#   MIN_TABLES    minimum number of restored tables, default 1
#   KEEP_SCRATCH  set to 1 to keep the scratch database for inspection
set -euo pipefail

: "${BACKUP_FILE:?set BACKUP_FILE to the dump file (or a folder of dumps)}"
PSQL="${PSQL:-psql}"
PG_RESTORE="${PG_RESTORE:-pg_restore}"
MIN_TABLES="${MIN_TABLES:-1}"

if [ -d "$BACKUP_FILE" ]; then
  # shellcheck disable=SC2012
  BACKUP_FILE="$(ls -t "$BACKUP_FILE"/* 2>/dev/null | head -1 || true)"
fi
[ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ] || { echo "no backup file found" >&2; exit 2; }

SCRATCH="restore_test_$(date +%s)_$$"
# shellcheck disable=SC2086
psql_db() { $PSQL -v ON_ERROR_STOP=1 -X -q -d "$1" "${@:2}"; }

cleanup() {
  if [ "${KEEP_SCRATCH:-0}" != "1" ]; then
    psql_db postgres -c "DROP DATABASE IF EXISTS \"$SCRATCH\"" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "restoring $BACKUP_FILE into $SCRATCH"
psql_db postgres -c "CREATE DATABASE \"$SCRATCH\"" >/dev/null

if [ "$(head -c 5 "$BACKUP_FILE")" = "PGDMP" ]; then
  # shellcheck disable=SC2086
  $PG_RESTORE --no-owner --no-privileges -d "$SCRATCH" < "$BACKUP_FILE"
else
  psql_db "$SCRATCH" < "$BACKUP_FILE" >/dev/null
fi

TABLES="$(psql_db "$SCRATCH" -At -c "SELECT count(*) FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema')")"
ROWS="$(psql_db "$SCRATCH" -At -c "SELECT coalesce(sum((xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint), 0) FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema')")"
echo "tables=$TABLES rows=$ROWS"

if [ "${TABLES:-0}" -lt "$MIN_TABLES" ]; then
  echo "restore produced $TABLES tables, expected at least $MIN_TABLES" >&2
  exit 1
fi
echo "RESTORE_OK"
