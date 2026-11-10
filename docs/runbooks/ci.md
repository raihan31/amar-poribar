# Runbook: CI

CI is the only gate (docs/tasks/README.md). A pull request merges when its required checks are green.

## Jobs

Defined in `.github/workflows/ci.yml`.

| Job | What it runs | Required |
|---|---|---|
| `ts-static` | `pnpm install --frozen-lockfile`, `lint`, `format:check`, `typecheck`, `arch`, `arch:negative`, `openapi:check`, `db:check`, `tools/gen-vectors.ts --check`, `node --test tools/eslint-rules/*.test.mjs`, `node --test tools/verify.test.mjs`, `pnpm no-drizzle-push` | yes |
| `ts-test` | PostgreSQL and MinIO from Compose (`db-test`, `minio-test`), `pnpm test`, `pnpm test:db`, `pnpm coverage` (API module domain/app >= 80%, `packages/*` >= 70%); coverage report uploaded | yes |
| `build` | `pnpm build` | yes |
| `stack` | `docker compose up -d --build --wait`, `bash tools/smoke.sh`, logs on failure, `down -v` | yes |
| `mobile` | build_runner, `flutter gen-l10n`, l10n key check, `dart format`, `flutter analyze --fatal-infos` (blocking), `flutter test --coverage`, goldens, `bash coverage_gate.sh` (70% on domain, data, core), `test/contract` when present | yes |
| `mobile-emulator` | integration tests on an Android emulator (main, and PRs that touch `apps/mobile`) | yes when it runs |
| `mobile-size` | release APK size gate (35 MB per ABI) | yes |
| `e2e-web`, `e2e-admin` | Playwright against the Compose stack; run once `apps/web/e2e` or `apps/admin/e2e` exists | yes when they run |
| `docs` | `node --test tools/check-docs.test.mjs`, `node tools/check-docs.mjs --warn` | yes |
| `milestone m0..m8` | `pnpm verify:mN`; non-blocking until `milestones/mN.done` exists, blocking after | m0..mN already tagged done |

Tool versions: `.node-version` (Node), `.flutter-version` (Flutter, also in `apps/mobile/.fvmrc`), `packageManager` in `package.json` (pnpm). Concurrency cancels older runs of the same ref.

Local equivalents, from the repository root:

| Check | Command |
|---|---|
| Lint, format | `pnpm lint`, `pnpm format:check` |
| Types, unit tests | `pnpm typecheck`, `pnpm test` |
| Module boundaries | `pnpm arch` |
| Database tests (need `docker compose up -d db minio`) | `pnpm test:db` |
| API contract drift | `pnpm openapi:check` |
| One milestone gate | `pnpm verify:m0` ... `pnpm verify:m8` (`node tools/verify.mjs --list m0` prints the commands) |
| Coverage | `pnpm coverage` (needs `docker compose --profile test up -d --wait db-test minio-test`) |
| Docs | `node tools/check-docs.mjs` and `node --test tools/check-docs.test.mjs` |
| Mobile | `cd apps/mobile && flutter analyze && flutter test` |

The `docs` check runs `tools/check-docs.mjs`. It runs with `--warn` (prints problems, exits 0) until `docs/tasks/05-web-admin.md` exists, and strictly after that; it also verifies the runbooks, task ids, screen codes and the BRD version.

## Required checks

Branch protection on `main` requires every job above that applies, an up-to-date branch, and no force pushes. Add a new job to this table in the same pull request that adds it.

## When CI is red

1. Read the first failing step, not the last. Reproduce locally with the command in the table.
2. A flaky test is a bug: fix it or quarantine it with a linked task; do not re-run until green.
3. Golden image changes need the new images committed from the pinned Flutter version (`3.47.6`, see `apps/mobile/.fvmrc`).
4. Never weaken or delete a check to get a merge.
