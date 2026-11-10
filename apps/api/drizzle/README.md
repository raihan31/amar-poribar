Baseline frozen at M0. Never edit existing migrations.

`0000_schemas.sql` creates the module schemas; `0001_baseline.sql` creates every table, type and sequence that existed at M0. Its statements are idempotent (`IF NOT EXISTS`, `duplicate_object` guards) because `platform/migrate.db.test.ts` re-applies migrations over an existing schema. New changes are new files made with `pnpm db:generate`; keep them idempotent in the same way.
