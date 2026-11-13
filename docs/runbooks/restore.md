# Runbook: backup and restore

Covers NFR-08: daily database backups kept 14 days, an automated weekly restore test into a scratch database, and the result visible in system health (FR-ADM-10).

## 1. Backup schedule

| What | When | Kept | How |
|---|---|---|---|
| PostgreSQL full dump | Daily at 02:00 Asia/Dhaka | 14 days | `pg_dump -Fc "$DATABASE_URL" -f backups/amar-$(date +%F).dump`, then upload to the backup bucket (not the media bucket) |
| Cleanup | After each dump | files older than 14 days are deleted | `find backups -name 'amar-*.dump' -mtime +14 -delete` or a bucket lifecycle rule of 14 days |
| Weekly restore test | Sunday 03:00 | result row kept 90 days | see section 3 |

The backup job records `last_backup_at` and its size; the restore test records `last_restore_test_at` and `ok|failed`. System health (G4) shows both, and an alert fires when a backup is older than 26 hours or a restore test older than 8 days.

## 2. Restore into a scratch database (manual)

Never restore over production first. Restore to a scratch database, check it, then decide.

```bash
# 1. pick the dump
ls -t backups/amar-*.dump | head -3
export BACKUP_FILE=backups/amar-2026-01-01.dump

# 2. create the scratch database
psql "$ADMIN_URL" -c 'CREATE DATABASE restore_scratch'

# 3. restore (custom format)
pg_restore --no-owner --no-privileges -d "$ADMIN_URL_BASE/restore_scratch" "$BACKUP_FILE"

# 4. sanity checks
psql "$ADMIN_URL_BASE/restore_scratch" -c "SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables ORDER BY 3 DESC LIMIT 15"
psql "$ADMIN_URL_BASE/restore_scratch" -c "SELECT max(at) FROM admin.audit_log"

# 5. drop it when done
psql "$ADMIN_URL" -c 'DROP DATABASE restore_scratch'
```

To recover production: stop the API, restore into a new database, run `pnpm db:migrate` against it if the dump is older than the deployed migrations, point `DATABASE_URL` at it, start the API, verify `/ready`. Keep the old database until the family data has been spot-checked. Events not yet delivered are in the outbox table and resume on start; data written after the backup (up to 24 hours) is lost, and phones re-send queued entries through offline sync (FR-SYNC).

## 3. Weekly automated restore test

`tools/restore-test.sh` does the whole check without a human:

1. Takes the newest dump from `BACKUP_FILE` (a file, or a folder where the newest file is used).
2. Creates a scratch database named `restore_test_<timestamp>_<pid>`.
3. Restores it (`pg_restore` for custom-format dumps, `psql` for plain SQL).
4. Runs a row-count sanity query across every user table and requires at least `MIN_TABLES` tables (default 1; set it to the expected table count in production).
5. Drops the scratch database and prints `RESTORE_OK`. Any failure exits non-zero and prints the reason.

The scheduled job runs `BACKUP_FILE=backups/ bash tools/restore-test.sh`, then writes `last_restore_test_at` and the status. Connection settings come from the standard `PGHOST`, `PGPORT`, `PGUSER` and `PGPASSWORD` variables. In a container setup, set `PSQL="docker exec -i <db> psql -U amar"` and `PG_RESTORE="docker exec -i <db> pg_restore -U amar"`. The script's own test is `bash tools/restore-test.test.sh`.

## 4. Object storage lifecycle

Applied to the media bucket (`S3_BUCKET`) by the infrastructure setup or `mc ilm` / `aws s3api put-bucket-lifecycle-configuration`:

| Rule | Prefix | Action |
|---|---|---|
| Abort incomplete multipart uploads | all | after 1 day |
| Delete voice notes | `voice/` | after 180 days (DEC-16) |
| Delete video messages | `video/` | after 180 days (DEC-16) |

Receipt images (`receipts/`) follow the family's data lifetime and are removed by the erasure workflow, not by lifecycle. Test the rules on a scratch bucket after any provider change. Call media is never recorded.
