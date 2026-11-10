# Runbook: CI

CI is the only gate (docs/tasks/README.md). A pull request merges when its required checks are green.

## Jobs

Defined in `.github/workflows/ci.yml`.

| Job | What it runs | Required |
|---|---|---|
| `web-api` (TypeScript) | `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build` | yes |
| `docs` | `node --test tools/check-docs.test.mjs`, `node tools/check-docs.mjs --warn` | yes |
| `docker` (Compose stack) | `docker compose up --build --wait`, then `/health` and web smoke checks (skipped until a Dockerfile exists) | yes |
| `mobile` (Flutter) | build_runner, `flutter gen-l10n`, l10n key check, `dart format`, `flutter analyze --fatal-infos`, `flutter test --coverage`, goldens, 70% coverage on domain, data and core | yes |
| `mobile-emulator` | integration tests on an Android emulator (runs on main, and on PRs that touch `apps/mobile`) | yes when it runs |
| `mobile-size` | release APK size gate (35 MB per ABI) | yes |

Local equivalents, from the repository root:

| Check | Command |
|---|---|
| Lint, format | `pnpm lint`, `pnpm format:check` |
| Types, unit tests | `pnpm typecheck`, `pnpm test` |
| Module boundaries | `pnpm arch` |
| Database tests (need `docker compose up -d db minio`) | `pnpm test:db` |
| API contract drift | `pnpm openapi:check` |
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
