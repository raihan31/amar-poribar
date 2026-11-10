# Task backlog

Companion to [SRS v1.0](../SRS.md). The SRS says **what** and **why**; these files say **exactly how**, in an order that lets an engineer or a coding agent work without asking anyone.

## Rules for every task (no human gates)

1. **CI is the only gate.** A task is done when its acceptance commands pass. There is no review meeting, manual QA, design sign-off or owner approval step.
2. **Decisions are already made** (SRS §2.6). If a task seems to need a decision, use the SRS rule, or the simplest option that meets the nearest requirement, and add one line to the pull request description.
3. **Each task is one pull request**, small enough to finish in one sitting (target ≤ 400 changed lines excluding generated files and tests). If a task needs more, split it as `T-XXX-nnA`, `T-XXX-nnB` in the same file.
4. **Every external service is a port with an in-memory fake** (SRS §1.5 rule 4). Tests never need real credentials.
5. **Tests first where practical**: write the failing test named in the task, then the code.
6. **No manual steps in acceptance.** Acceptance is always a command, a test name that must pass, a file that must exist, or a metric threshold.

## Task template

```
### T-AREA-nn · Title
- **Closes:** FR-…, NFR-…, GAP-…
- **Depends on:** T-…
- **Milestone:** M0..M8
- **Layer:** api | mobile | web | admin | platform | docs
**Why** — one or two sentences linking the requirement to the user-visible outcome.
**Files** — every path to create (C) or change (M); folders listed with their purpose.
**Steps** — numbered, concrete, in order. Names of functions, tables, columns, routes, events, env vars.
**Contract** — request/response shapes, table DDL summary, event payloads, error codes.
**Tests** — test file paths and the case names to write (one line per case).
**Acceptance** — commands that must exit 0 and any thresholds.
**Done when** — the observable result.
```

## Naming and ID reservations

| File | IDs |
|---|---|
| `01-platform.md` | `T-PLAT-nn` |
| `02-backend-core.md` | `T-ID-`, `T-FAM-`, `T-LED-`, `T-BUD-`, `T-REC-`, `T-AI-`, `T-REP-`, `T-SYNC-` |
| `03-backend-engage.md` | `T-COMM-`, `T-NOTIF-`, `T-SHOP-`, `T-LEND-`, `T-BILL-`, `T-PRIV-`, `T-ADM-` |
| `04-mobile.md` | `T-MOB-nn` |
| `05-web-admin.md` | `T-WEB-nn`, `T-ADMUI-nn` |

Numbers are two digits, never reused. Cross-file references use the full ID. If a task needs something from another file that does not exist yet, it states the dependency by ID and by the capability it needs ("an `entitlements(familyId)` facade"), so work can start against the interface.

## Conventions shared by all tasks

**Backend module skeleton** (SRS §3.2): `index.ts` (facade), `http/`, `domain/`, `app/`, `infra/`, `schema.ts`, `events.ts`, `jobs.ts`. A new module is created by `pnpm gen:module <name>` (added in T-PLAT-03).

**Commands** available after T-PLAT-01..12:

| Command | Meaning |
|---|---|
| `pnpm typecheck` | TypeScript across the workspace |
| `pnpm lint` | ESLint (includes module-boundary rules) |
| `pnpm test` | Unit tests |
| `pnpm test:db` | API tests against a real PostgreSQL (started by `docker compose up -d db minio`) |
| `pnpm arch` | `dependency-cruiser` rules plus `architecture.test.ts` |
| `pnpm openapi:check` | Regenerates `apps/api/openapi.json` and fails on a diff |
| `pnpm db:migrate` / `pnpm db:generate` | Apply / generate SQL migrations |
| `pnpm e2e:web`, `pnpm e2e:admin` | Playwright |
| `pnpm verify:mN` | All checks for milestone N (SRS §13.1) |
| `cd apps/mobile && flutter analyze && flutter test` | Mobile gate (blocking) |

**Test data**: `pnpm seed:dev` creates the demo family "রহিম পরিবার" with five members, accounts, categories, budgets, 120 transactions, and a conversation. E2E tests use `tools/fixtures` builders, never hand-written SQL.

**Naming**: events `module.PastTense.vN`; tables snake_case in their module schema; routes under `/v1`; error codes snake_case.

**Bangla copy**: user-facing Bangla strings live in `packages/shared/src/i18n/bn.ts` (web/API) and `apps/mobile/lib/l10n/app_bn.arb` (mobile). The design canvas is the source for wording; tasks quote the exact string when it matters for a test.

## Milestone order

`M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8` as in SRS §13.1. Within a milestone, tasks may run in parallel when their `Depends on` lines allow.

## Design files

The 52 design boards are saved in `docs/design/screens/*.dc.html` (index: `docs/design/canvas.json`). A task that names a board such as `Chat.dc.html` means `docs/design/screens/Chat.dc.html`. Each file is plain HTML with inline styles, so the exact copy, sizes and colours can be read directly. The live canvas is https://claude.ai/artifact/4h5SPurNz7kAb1oJQdozwW.

## Requirements without their own task

A few SRS requirements do not have a task that names them. They are covered as follows, so nothing is missing:

| Requirement | Why there is no separate task | What protects it |
|---|---|---|
| FR-ACC-02, FR-CAT-03, FR-AI-03, FR-AI-04, FR-AI-05, FR-AI-13, FR-VOICE-02, FR-VOICE-03, FR-SYNC-01 | Already built and tested in the repository | Existing tests (`packages/ai/src/*.test.ts`, `packages/shared/src/*.test.ts`, `apps/mobile/test/**`) must keep passing through the module moves (T-PLAT-22..29) |
| FR-AI-08 | A pointer to FR-VOICE-01..03 | Same as above |
| FR-VIDEO-05, FR-VIDEO-08 | Part of the call screen and busy handling | T-MOB-69 (controls, quality words, busy message), T-COMM-17 (busy outcome) |
| FR-VNOTE-05 | A negative rule: voice notes are never sent to AI | T-COMM voice-note tasks add no AI import; `pnpm arch` fails if `comms` imports `ai` |
| FR-AUTH-06 | P3 "could": optional email or Google sign-in | Intentionally not scheduled; add it when needed |
