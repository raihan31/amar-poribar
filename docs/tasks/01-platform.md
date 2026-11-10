# T-PLAT — Platform, architecture and delivery foundation

Area owner file for SRS §3 (modular monolith), §5.3–5.5, §11.2–11.3, §12.2 (GAP-ARCH-01..12), §13.1 (M0).
Read [README.md](./README.md) first for the template, rules and commands.

## How to read this file

- Tasks are numbered in the order they are **safe to start**. Each lists `Depends on`.
- **Every task is one pull request.** Tasks that move existing code (T-PLAT-23..31) must keep **all existing tests green and change no behaviour**; they only move files, change imports and route through facades.
- Facts about the repository at commit `e2ef7bc` that these tasks rely on:
  - `apps/api/src/app.ts` builds Fastify, registers `registerAuth`, then ten route plugins from `src/routes/*.ts` (`auth, families, invites, sync, transactions, ai, budgets, festivals, recurring, reports`), each taking `AppDeps = { db, otp, anthropic?, aiModel?, jwtSecret, isProd, corsOrigins? }`.
  - `apps/api/src/db/schema.ts` (208 lines) declares all tables in the default `public` schema, plus enums (`role`, `account_type`, `txn_type`, `txn_source`, `category_kind`) and the sequence `txn_sync_seq` used by `transactions.sync_seq`.
  - Helper files next to routes: `auth.ts` (JWT registration + `requireRole`, `canEditAll`, `canAssignRole`, `canManageMember`), `errors.ts` (`HttpError`, `parseOr400`, `registerErrorHandler`), `env.ts`, `hlc.ts` (`formatHlc`, `parseHlc`, `sendHlc`, `receiveHlc`, `winsOver`, `nextHlc`, `ClockDriftError`), `month.ts`, `totals.ts` (`monthTotals`), `budgets.ts`, `recurring.ts`, `csv.ts`, `otp.ts`.
  - Tests: `app.test.ts` (304 lines, no database), `env.test.ts`, `hlc.test.ts`; manual `scripts/e2e.mjs` (173 lines, needs a running API and Postgres).
  - `docker-compose.yml` has `db`, one-shot `migrate` (`drizzle-kit push --force`), `api`, `web`. `Dockerfile` has targets `base`, `build`, `api`, `web`.
  - CI (`.github/workflows/ci.yml`): jobs `web-api` (typecheck, test, build), `docker` (compose smoke, skipped without a Dockerfile), `mobile` (`flutter test`, `flutter analyze` with `continue-on-error: true`).
  - `packages/shared/src/i18n.ts` is a single file (the README path `i18n/bn.ts` is created in T-PLAT-35).

## Build order and parallelism

```
Wave 1 (parallel):   T-PLAT-01  T-PLAT-04  T-PLAT-06  T-PLAT-35
Wave 2 (parallel):   T-PLAT-02 then T-PLAT-03 ;  T-PLAT-05 (after 04) ;  T-PLAT-07 (after 02, 04)
Wave 3 (parallel):   T-PLAT-19 harness (after 07) ;  T-PLAT-17 fakes SMS+FCM (after 04) ;
                     T-PLAT-08 events, T-PLAT-10 rate limit, T-PLAT-11 flags (after 07; their DB tests run once 19 exists) ;
                     T-PLAT-12 storage (after 04)
Wave 4 (parallel):   T-PLAT-09 jobs (after 08) ;  T-PLAT-13 ws hub (after 08, 10) ;  T-PLAT-14 openapi (after 06) ;
                     T-PLAT-18 fakes payments+claude+coturn (after 17) ;  T-PLAT-20 fixtures + seed (after 19)
Wave 5 (parallel):   T-PLAT-15 health+metrics (after 05, 09) ;  T-PLAT-16 contract vectors (after 14, 20)
Wave 6 (parallel):   T-PLAT-21 tenant-isolation test (after 14, 19, 20) ;  T-PLAT-22 staff-safe lint (after 03)
Wave 7 (sequential, same files): T-PLAT-23 identity -> 24 families -> 25 ledger -> 26 budgeting -> 27 recurring
                     -> 28 ai -> 29 reporting -> 30 sync -> 31 cleanup + baseline freeze
                     (26, 27, 29, 30 only depend on 25 and may run in parallel after it; they touch different files)
Wave 8 (parallel after 31): T-PLAT-32 compose/Docker  T-PLAT-33 CI + verify scripts  T-PLAT-34 docs + runbooks
```
M0 is complete when `pnpm verify:m0` passes (T-PLAT-33).

---

### T-PLAT-01 · Root tooling: ESLint, Prettier, scripts, workspace hygiene
- **Closes:** NFR-11, GAP-ARCH-10 (lint part)
- **Depends on:** none
- **Milestone:** M0
- **Layer:** platform
**Why** — `turbo.json` defines a `lint` task but no package has a `lint` script, so `pnpm lint` checks nothing. Later tasks add custom lint rules (module boundaries, staff-safe) and need a working ESLint setup.
**Files**
- C `eslint.config.mjs` (flat config, root)
- C `.prettierrc.json`, C `.prettierignore`
- M `package.json` (root): devDependencies `eslint@^9`, `typescript-eslint@^8`, `eslint-plugin-import@^2`, `prettier@^3`; scripts below
- M `apps/api/package.json`, `apps/web/package.json`, `packages/shared/package.json`, `packages/ai/package.json`: add `"lint": "eslint ."`
- M `turbo.json`: `lint` task `dependsOn: []`, add `arch`, `openapi:check` pass-through tasks (no cache)
**Steps**
1. Add dev dependencies at the root with `pnpm add -Dw eslint typescript-eslint eslint-plugin-import prettier`.
2. `eslint.config.mjs`: `export default tseslint.config(...)` with `tseslint.configs.recommendedTypeChecked`, parser options `projectService: true`, ignores `**/dist/**`, `**/.next/**`, `apps/mobile/**`, `**/*.g.dart`, `apps/api/drizzle/**`. Rules: `@typescript-eslint/no-floating-promises: error`, `@typescript-eslint/consistent-type-imports: error`, `no-console: ["error", { allow: ["warn", "error"] }]` (the only existing `console.log` is in `apps/api/src/server.ts`; replace it with the logger in T-PLAT-05, and allow it in `server.ts` until then via an inline disable).
3. `.prettierrc.json`: `{ "printWidth": 120, "singleQuote": false, "trailingComma": "all" }` (matches current code style).
4. Add root scripts: `"format": "prettier --write ."`, `"format:check": "prettier --check ."`, `"lint": "turbo run lint"`, and placeholders that later tasks fill: `"arch": "echo 'added in T-PLAT-03' && exit 0"`, `"openapi:check": "echo 'added in T-PLAT-14' && exit 0"`, `"test:db": "echo 'added in T-PLAT-19' && exit 0"`. Each placeholder is replaced by its task; the task must remove the `echo`.
5. Run `pnpm format` once in a separate first commit (formatting only), then fix lint errors without changing behaviour (type-only import fixes).
**Contract** — none.
**Tests** — none new; the existing `pnpm test` must stay green.
**Acceptance**
- `pnpm install --frozen-lockfile && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` exits 0.
**Done when** — `pnpm lint` actually lints `apps/api`, `apps/web`, `packages/shared`, `packages/ai`.

---

### T-PLAT-02 · Module skeleton, registry and `pnpm gen:module`
- **Closes:** SRS §3.1–3.2, R8, GAP-ARCH-01
- **Depends on:** T-PLAT-01
- **Milestone:** M0
- **Layer:** api
**Why** — every later task adds or fills a module. A fixed skeleton and one registry file make the structure mechanical and testable.
**Files**
- C `apps/api/src/platform/module.ts` — types `ModuleContext`, `ModuleDefinition<F>`, `Facades`
- C `apps/api/src/modules/registry.ts` — ordered list of module definitions
- C `apps/api/src/modules/<name>/{index.ts,schema.ts,events.ts,jobs.ts}` + folders `http/ app/ domain/ infra/` (each with a `.gitkeep`) for the 15 modules: `identity families ledger budgeting recurring ai reporting sync comms notifications shopping lending billing privacy admin` (platform is not a module folder; it lives in `src/platform`)
- C `tools/gen-module.mjs` — scaffolding script
- M `package.json` (root): `"gen:module": "node tools/gen-module.mjs"`
- M `apps/api/src/app.ts` — keep behaviour; add the registry loop but with an empty registry for now
**Steps**
1. `platform/module.ts`:
   ```ts
   export interface ModuleContext {
     db: Db;                 // drizzle client (platform/db)
     config: Config;         // platform/config
     logger: FastifyBaseLogger;
     bus: EventBus;          // T-PLAT-08 (type only for now)
     jobs: Jobs;             // T-PLAT-09
     storage: ObjectStorage; // T-PLAT-12
     flags: Flags;           // T-PLAT-11
     clock: () => Date;
     facades: Facades;       // filled as modules register
   }
   export interface ModuleDefinition<F = unknown> {
     name: string;
     dependsOn: readonly string[];          // names; checked against SRS §3.3 table by the arch test
     register(app: FastifyInstance, ctx: ModuleContext): Promise<F> | F;   // returns the facade instance
   }
   export type Facades = Record<string, unknown>;  // narrowed per module through declaration merging in each index.ts
   ```
2. Each `modules/<name>/index.ts` exports: (a) the facade **interface** `XFacade`, (b) DTO types, (c) event types re-exported from `events.ts`, (d) `export const xModule: ModuleDefinition<XFacade>`. Nothing from `infra/`, `http/` or `schema.ts` is exported (R3).
3. Declaration merging in each `index.ts`: `declare module "../../platform/module.js" { interface Facades { families: FamiliesFacade } }` so `ctx.facades.families` is typed.
4. `registry.ts` exports `modules: ModuleDefinition[]` in dependency order (identity, families, billing, ledger, budgeting, recurring, ai, reporting, sync, notifications, comms, shopping, lending, privacy, admin; `billing` comes before `ai` because `ai` depends on it). `app.ts` loops: `for (const m of modules) ctx.facades[m.name] = await m.register(app, ctx)`. R8: nothing else lists modules.
5. `tools/gen-module.mjs <name> [dep,dep]`: creates the folder tree, an `index.ts` with the facade/def stub, an empty `schema.ts` (`export const <name>Schema = pgSchema("<name>");`), `events.ts` (`export {};`), `jobs.ts` (`export const jobs = [];`), a `<name>.test.ts` placeholder, and appends the module to `registry.ts` between the markers `// <modules>` and `// </modules>`.
6. Create all 16 modules by running the generator (so the generator itself is exercised), then commit.
**Contract** — `ModuleDefinition.dependsOn` must equal the SRS §3.3 table (asserted in T-PLAT-03).
**Tests**
- `apps/api/src/modules/registry.test.ts`: `registers every module exactly once`, `registers modules after their dependsOn`, `gen:module creates the expected tree` (runs the script into a temp dir with `--root` option and asserts the files).
**Acceptance**
- `pnpm gen:module demo --root /tmp/gm-test && test -f /tmp/gm-test/modules/demo/index.ts`
- `pnpm --filter @amar-poribar/api test -- registry` and `pnpm typecheck` exit 0.
**Done when** — `apps/api/src/modules/*` exists for all 15 modules, is registered in order, and the API still starts and passes all existing tests.

---

### T-PLAT-03 · Boundary rules: dependency-cruiser and architecture test (R1–R9)
- **Closes:** R1..R9, NFR-21, AC-42, GAP-ARCH-01
- **Depends on:** T-PLAT-02
- **Milestone:** M0
- **Layer:** api
**Why** — the modular monolith only holds if violations fail CI.
**Files**
- C `.dependency-cruiser.cjs`
- C `apps/api/src/architecture.test.ts`
- C `apps/api/src/platform/arch/module-deps.ts` — the SRS §3.3 table as data
- M `package.json` (root): `"arch": "depcruise apps/api/src --config .dependency-cruiser.cjs && pnpm --filter @amar-poribar/api exec vitest run src/architecture.test.ts"`; devDependency `dependency-cruiser@^16`
**Steps**
1. `.dependency-cruiser.cjs` `forbidden` rules (name → intent):
   - `no-cross-module-internals` (R1): `from.path: "^apps/api/src/modules/([^/]+)/"`, `to.path: "^apps/api/src/modules/([^/]+)/(?!index\\.ts$)"`, `to.pathNot` the same module via backreference `$1` → severity error.
   - `no-circular` (R2): `circular: true`.
   - `module-direction` (R2): generated at load time from `module-deps.ts`; a module may import only `index.ts` of modules in its `dependsOn`.
   - `schema-not-exported` (R3): no file other than `modules/<m>/schema.ts` and `modules/<m>/infra/**` may import `schema.ts`; `index.ts` must not re-export from `./schema`.
   - `domain-pure` (R7): `modules/*/domain/**` may import only `domain/`, `platform/` types, and `node:` builtins; forbidden: `drizzle-orm`, `fastify`, `../infra`, `../http`.
   - `platform-independent`: `src/platform/**` may not import `src/modules/**`.
   - `composition-allowed`: `src/composition/**` may import any `modules/*/index.ts` (documented exception, see T-PLAT-24 step 6).
   - `admin-staff-safe-only` (R6): placeholder rule, completed by T-PLAT-22.
2. `module-deps.ts` exports `const MODULE_DEPS: Record<string, readonly string[]>` copied from SRS §3.3: identity [], families [identity], ledger [families], budgeting [families, ledger], recurring [families, ledger], ai [families, ledger, billing], reporting [families, ledger], sync [families, ledger], comms [families, identity, notifications], notifications [identity, families], shopping [families, ledger], lending [families], billing [families], privacy [identity, families, ledger, comms], admin [families, billing, privacy].
   Note: `ai → billing` and `comms → notifications → …` create no cycle; `notifications` must not depend on `comms`.
3. `architecture.test.ts` cases (reads the file system, no database):
   - every folder in `src/modules` has `index.ts`, `schema.ts`, `events.ts` (R9);
   - every `ModuleDefinition.dependsOn` equals `MODULE_DEPS[name]`;
   - `registry.ts` order is a topological order of `MODULE_DEPS`;
   - no `pgTable(` outside `modules/*/schema.ts` and `platform/**` (R3);
   - every `pgSchema("x")` name equals its folder name (DEC-02);
   - no `references(` pointing at another module's table (no cross-schema FK, DEC-02) — implemented by parsing each `schema.ts` for `.references(() => other.table.id)` and checking the imported symbol is local;
   - only `src/app.ts` and `modules/registry.ts` import more than one module's `index.ts` besides `composition/` (R8).
4. Fix any violation in current code by making the offending import go through `index.ts`; at this point only the skeleton exists, so the test must pass trivially. T-PLAT-23..30 keep it passing as code moves.
**Contract** — `pnpm arch` exit code is the single result.
**Tests** — the cases above; plus `apps/api/src/arch-fixtures/` with three tiny violating projects (cross-internal import, cycle, cross-schema FK) run through the same checker to prove each rule fails (`rule R1 fails on internal import`, `rule R2 fails on cycle`, `rule R3 fails on cross-schema FK`).
**Acceptance**
- `pnpm arch` exits 0.
- `pnpm arch:negative` (script that runs the fixtures and expects failures) exits 0.
**Done when** — a deliberate `import "../../ledger/infra/x"` in another module makes `pnpm arch` fail.

---

### T-PLAT-04 · Typed configuration (`platform/config`)
- **Closes:** GAP-ARCH-06 (config part), SRS §3.6, §1.5 rule 7
- **Depends on:** T-PLAT-01
- **Milestone:** M0
- **Layer:** api
**Why** — `env.ts` is a plain object that throws on its own at import time. New services (S3, FCM, SMS, TURN, payments) need many variables with safe defaults per environment.
**Files**
- C `apps/api/src/platform/config.ts`, C `apps/api/src/platform/config.test.ts`
- M `apps/api/src/env.ts` → temporarily re-exports from `platform/config.ts` (deleted in T-PLAT-31)
- M `apps/api/src/env.test.ts` (keep its three existing cases, repointed)
- M `.env.example`
**Steps**
1. Define a Zod schema `ConfigSchema` and `loadConfig(env = process.env): Config`. Fields (name → default in dev / rule in prod):
   - `NODE_ENV` (`development|test|production`), `PORT` 4000, `DATABASE_URL` (dev default as today), `JWT_SECRET` (existing prod rule: ≥ 32 chars and not matching `/change-?me/i`), `CORS_ORIGIN` (comma list).
   - `ANTHROPIC_API_KEY?`, `AI_MODEL?` (as today).
   - `SMS_GATEWAY` (`fake|sslwireless|alphasms`, default `fake`; prod must not be `fake`), `SMS_API_KEY?`, `SMS_SENDER_ID?`.
   - `PUSH_PROVIDER` (`fake|fcm`), `FCM_PROJECT_ID?`, `FCM_SERVICE_ACCOUNT_JSON?`.
   - `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_REGION` (dev defaults point at MinIO `http://localhost:9000`, bucket `amar`).
   - `TURN_URLS` (comma list), `TURN_SECRET`, `TURN_TTL_SECONDS` 3600.
   - `PAYMENT_PROVIDER` (`fake|real`), `BKASH_*`, `NAGAD_*`, `SSLCOMMERZ_*` optional groups, required together when their provider is selected.
   - `ROLE` (`api|worker|all`, default `all`), `LOG_LEVEL`, `METRICS_TOKEN?`.
   - `FEATURE_FLAGS?` (comma list `flag=on|off`).
2. `loadConfig` returns a frozen, typed object with camelCase keys and a `isProd` flag; on failure it throws one `Error` that lists **all** invalid variables (use `z.prettifyError`).
3. `env.ts` becomes `export const env = loadConfig()` plus the old property names (`port`, `databaseUrl`, `jwtSecret`, `anthropicApiKey`, `aiModel`, `corsOrigins`, `isProd`) so existing imports keep working.
4. `.env.example`: document every variable with a comment, grouped per service; remove the stale `EXPO_PUBLIC_API_URL` (the app is Flutter).
**Contract** — `Config` type exported from `platform/config.ts`; nothing else reads `process.env`. Add an ESLint rule `no-restricted-properties` for `process.env` outside `platform/config.ts` and `*.test.ts`.
**Tests** (`config.test.ts`)
- `defaults work in development`
- `production rejects short JWT_SECRET` (existing case moved)
- `production rejects SMS_GATEWAY=fake`
- `lists every invalid variable in one error`
- `payment provider group requires all keys when selected`
- `CORS_ORIGIN parses comma separated list`
**Acceptance** — `pnpm --filter @amar-poribar/api test -- config env` and `pnpm lint` exit 0.
**Done when** — adding a variable requires changing exactly one file.

---

### T-PLAT-05 · Logger with redaction, request ids and request context
- **Closes:** NFR-12, GAP-ARCH-06
- **Depends on:** T-PLAT-04
- **Milestone:** M0
- **Layer:** api
**Why** — logs must never contain phone numbers, tokens or message bodies (PDPO, SRS §11.4), and every log line must be traceable by request id.
**Files**
- C `apps/api/src/platform/logger.ts`, C `apps/api/src/platform/request-context.ts`, C `apps/api/src/platform/logger.test.ts`
- M `apps/api/src/app.ts` — build Fastify with `loggerInstance`, `genReqId`, `requestIdHeader`
- M `apps/api/src/server.ts` — replace `console.log` with `app.log.info`
**Steps**
1. `logger.ts` exports `createLoggerOptions(config)`: pino options with `level`, `redact: { paths: [...], censor: "[redacted]" }`. Paths: `req.headers.authorization`, `req.headers.cookie`, `*.token`, `*.refreshToken`, `*.accessToken`, `*.code`, `*.phone`, `*.body` (for chat), `*.fcmToken`, `*.password`, `*.totp`. Add a `formatters.log` hook that replaces any `+8801\d{9}` / `01\d{9}` found in string values by `•••` plus last 3 digits.
2. Request id: Fastify option `genReqId: () => uuidv7()` (use `crypto.randomUUID()` until a v7 helper exists in T-PLAT-08), accept incoming `x-request-id` when it matches `/^[A-Za-z0-9-]{8,64}$/`, always echo it in the response header `x-request-id`.
3. `request-context.ts`: `AsyncLocalStorage<{ requestId, userId?, familyId? }>` with `runWithContext`, `getContext()`. A Fastify `onRequest` hook enters the store; the auth hook (T-PLAT-23) sets `userId`; routes with `:familyId` set `familyId` in a `preValidation` hook. Logger mixin adds these fields to every line.
4. Log one access line per request on `onResponse` with `{ method, route (pattern, not URL), status, ms }`. URLs containing `:familyId` are logged as the route pattern so ids are not spread through logs.
**Contract** — every response carries `x-request-id`; every log line has `reqId`.
**Tests** (`logger.test.ts`)
- `redacts authorization header and tokens`
- `masks phone numbers inside free text`
- `echoes a valid x-request-id and replaces an invalid one`
- `adds userId and familyId from request context`
**Acceptance** — `pnpm --filter @amar-poribar/api test -- logger` exits 0; `grep -rn "console.log" apps/api/src | grep -v test` prints nothing.
**Done when** — a test that logs `{ phone: "+8801712345678" }` shows `•••678` in the captured output.

---

### T-PLAT-06 · Error model (`platform/errors`)
- **Closes:** SRS §5.2 conventions, GAP-ARCH-06
- **Depends on:** T-PLAT-01
- **Milestone:** M0
- **Layer:** api
**Why** — `errors.ts` has `HttpError(status, code, message)` only. Clients need `details` (for example `attemptsLeft`, `retryAfterSeconds`) and a stable envelope.
**Files**
- C `apps/api/src/platform/errors.ts` (moved from `src/errors.ts`; the old file re-exports until T-PLAT-31)
- C `apps/api/src/platform/errors.test.ts`
- M `packages/shared/src/schemas.ts` — add `ApiErrorSchema`
**Steps**
1. Extend `HttpError` with an optional fourth constructor argument `details?: Record<string, unknown>`. Keep `(status, code, message)` working.
2. Add helpers: `notFound(msg)`, `forbidden(msg)`, `conflict(code, msg)`, `tooManyRequests(code, retryAfterSeconds)` (also sets header `Retry-After`).
3. Keep `parseOr400(schema, data)` unchanged in behaviour (code `invalid_request`).
4. `registerErrorHandler`: output `{ error: { code, message, details? } }`; map Fastify validation and `FST_ERR_*` body-too-large to `invalid_request`/`payload_too_large` (413); unknown errors → 500 `internal` with `message: "Something went wrong"` and the request id in `details.requestId`; never leak stack traces.
5. `ApiErrorSchema` in shared: `{ error: { code: string; message: string; details?: Record<string, unknown> } }`. Register it as the schema of `4xx/5xx` responses in T-PLAT-14.
**Contract** — status → code table (documented in the file header): 400 `invalid_request`, 401 `unauthorized`, 403 `forbidden`, 404 `not_found`, 409 `duplicate`/`duplicate_trx_id`/`id_taken`, 413 `payload_too_large`, 423 `family_suspended`, 429 `rate_limited`/`ai_quota`/`nudge_rate_limited`/`otp_rate_limited`, 500 `internal`.
**Tests**
- `HttpError with details is serialised`
- `unknown error becomes 500 without stack`
- `Retry-After header is set by tooManyRequests`
- `existing 3-arg HttpError still works`
**Acceptance** — `pnpm --filter @amar-poribar/api test -- errors` exits 0; existing `app.test.ts` still passes.
**Done when** — every error body in the existing tests still matches `{ error: { code, message } }`.

---

### T-PLAT-07 · Database layer, per-module schemas, SQL migrations (replace `drizzle-kit push`)
- **Closes:** DEC-02, DEC-11, GAP-ARCH-02
- **Depends on:** T-PLAT-02, T-PLAT-04
- **Milestone:** M0
- **Layer:** api
**Why** — the schema is applied with `drizzle-kit push --force`, which cannot be reviewed or repeated safely. Each module needs its own Postgres schema.
**Files**
- C `apps/api/src/platform/db.ts` — `createDb(config)` returns `{ db, sql, close }`
- C `apps/api/src/platform/migrate.ts` — `runMigrations(sql)`
- C `apps/api/src/platform/schema-names.ts` — constant list of module schema names
- M `apps/api/drizzle.config.ts` — `schema: "./src/modules/*/schema.ts"`, `schemaFilter: [...module schema names, "platform"]`, `out: "./drizzle"`
- C `apps/api/drizzle/` (generated by T-PLAT-31's baseline)
- M `apps/api/package.json` scripts: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "tsx src/platform/migrate-cli.ts"`, `"db:reset": "tsx src/platform/reset-cli.ts"`, remove `"db:push"`; root `package.json` `"db:push"` removed, `"db:migrate"`, `"db:reset"` added
- C `apps/api/src/platform/migrate-cli.ts`, C `apps/api/src/platform/reset-cli.ts` (refuses when `NODE_ENV=production`)
- M `apps/api/src/db/client.ts` → re-export from `platform/db.ts` (kept until T-PLAT-31)
**Steps**
1. `createDb`: `postgres(config.databaseUrl, { max: config.dbPoolMax ?? 10 })` + `drizzle(sql, { schema })`; export type `Db`. Add `config.dbPoolMax` (default 10, `DB_POOL_MAX`).
2. `schema-names.ts`: `["identity","families","ledger","budgeting","recurring","ai","reporting","sync","comms","notifications","shopping","lending","billing","privacy","admin","platform"]` (modules with no tables keep an empty schema file).
3. `runMigrations(sql)`: create schema `platform` and table `platform.schema_migrations(id text primary key, applied_at timestamptz default now())` if missing; read `apps/api/drizzle/*.sql` ordered by filename; for each file not recorded, run it inside one transaction and insert its id; take `pg_advisory_lock(727001)` so concurrent starts do not race. Use the Drizzle migrator folder format (`meta/_journal.json`) so `drizzle-kit generate` output works unchanged: call `migrate(db, { migrationsFolder, migrationsSchema: "platform", migrationsTable: "schema_migrations" })` from `drizzle-orm/postgres-js/migrator`.
4. API start order in `server.ts` (T-PLAT-31): load config → `createDb` → `runMigrations` (skippable with `MIGRATE_ON_START=false`) → build app. Worker role does the same.
5. Create `CREATE SCHEMA IF NOT EXISTS` statements for every name in `schema-names.ts` in a hand-written first file `drizzle/0000_schemas.sql` (drizzle-kit does not emit `CREATE SCHEMA` for `pgSchema` automatically in all versions); `db:generate` output follows as `0001_*`.
6. `reset-cli.ts`: `DROP SCHEMA ... CASCADE` for every module schema and `public.__drizzle_migrations`, then run migrations. Used by tests and by developers upgrading from the old `public` layout (no production database exists yet; document this in the PR).
7. CI drift check (script `apps/api/scripts/check-migrations.mjs`): run `drizzle-kit generate --name drift` into a temp dir and fail if it would produce a non-empty migration. Wired as `pnpm db:check`.
**Contract** — `schema_migrations` lives in `platform`; migration files are append-only after T-PLAT-31 freezes the baseline.
**Tests** (`platform/migrate.test.ts`, needs the DB harness; skipped until T-PLAT-19 then enabled — mark with `it.skipIf(!process.env.TEST_DATABASE_URL)`)
- `applies migrations once and records them`
- `second run is a no-op`
- `concurrent runs do not double apply` (two parallel `runMigrations` calls)
- `reset refuses in production`
**Acceptance** — `pnpm --filter @amar-poribar/api typecheck` exits 0; after T-PLAT-19: `pnpm test:db -- migrate` exits 0; `pnpm db:check` exits 0 after T-PLAT-31.
**Done when** — `grep -rn "drizzle-kit push" . --include=*.yml --include=*.yaml --include=*.json --include=Dockerfile` finds nothing (cleanup completed in T-PLAT-32/33).

---

### T-PLAT-08 · Event bus and transactional outbox
- **Closes:** DEC-03, GAP-ARCH-03, SRS §3.5
- **Depends on:** T-PLAT-07
- **Milestone:** M0
- **Layer:** api
**Why** — modules must react to each other without importing each other and without losing events on a crash. Some reactions must be part of the same transaction (seeding a new family's categories); others can be asynchronous (push notifications).
**Files**
- C `apps/api/src/platform/events/{bus.ts,outbox.schema.ts,drain.ts,types.ts,uuid7.ts}`
- C `apps/api/src/platform/events/bus.test.ts`
- M `apps/api/drizzle.config.ts` (include `src/platform/events/outbox.schema.ts`)
**Steps**
1. Table `platform.outbox`: `id uuid pk` (v7), `name text`, `payload jsonb`, `occurred_at timestamptz default now()`, `family_id uuid null`, `status text default 'pending'` (`pending|done|dead`), `attempts int default 0`, `next_attempt_at timestamptz default now()`, `last_error text null`; index `(status, next_attempt_at)`.
2. `types.ts`: `interface DomainEvent<N extends string, P> { id: string; name: N; payload: P; occurredAt: Date; familyId?: string }`. Each module's `events.ts` declares its event types and a registry type merge `interface EventMap { "ledger.TransactionCreated.v1": TransactionCreatedPayload; ... }` via declaration merging in `platform/events/types.ts`.
3. `EventBus` API:
   - `publish(tx, name, payload, opts?)` — writes one `platform.outbox` row inside the caller's transaction `tx` and synchronously runs **in-transaction subscribers** registered with `onInTx(name, handler)`; an exception rolls the caller's whole transaction back. Use only for invariants (for example `ledger` seeding after `families.FamilyCreated.v1`).
   - `on(name, handlerName, handler)` — **durable subscriber**, invoked by the drainer with `(event, ctx)`; `handlerName` must be unique and is stored in `platform.outbox_deliveries(event_id, handler, status, attempts, last_error)` so one failing handler does not repeat the others.
   - `publishInProcess(name, payload)` for non-durable signals (websocket fan-out); not persisted.
4. `drain.ts`: `drainOnce(limit = 50)` selects pending rows `FOR UPDATE SKIP LOCKED` where `next_attempt_at <= now()`, calls each subscriber not yet `done` in `outbox_deliveries`, sets delivery status, and when all handlers are done sets the row `done`. On error: `attempts += 1`, `next_attempt_at = now() + least(2^attempts, 600) seconds`; at attempt 10 set status `dead`. Handlers must be idempotent (event id passed in).
5. Add `uuid7()` in `uuid7.ts` (timestamp-ordered UUID) and use it for event ids; also export it for message ids later.
6. Retention: `platform.outbox` rows with `status='done'` older than 7 days are deleted by the job in T-PLAT-09.
**Contract** — event name format `module.PastTense.vN`; payloads contain ids and small facts, never free text from users (messages, notes).
**Tests** (`bus.test.ts`, DB harness)
- `publish writes outbox row in the callers transaction and rolls back with it`
- `in-tx subscriber failure rolls back the publisher`
- `durable subscribers each receive the event once`
- `failing handler retries with backoff and others are not repeated`
- `event moves to dead after 10 attempts`
- `drain is safe with two concurrent drainers` (SKIP LOCKED)
**Acceptance** — after T-PLAT-19: `pnpm test:db -- events` exits 0.
**Done when** — publishing inside `db.transaction(async tx => bus.publish(tx, ...))` is the only documented way to emit.

---

### T-PLAT-09 · Job queue (pg-boss) with schedules and dead letters
- **Closes:** DEC-04, GAP-ARCH-03, SRS §3.6
- **Depends on:** T-PLAT-08
- **Milestone:** M0
- **Layer:** api
**Why** — alerts, reminders, retention, exports and the outbox drainer need a scheduler without Redis.
**Files**
- C `apps/api/src/platform/jobs/{jobs.ts,define.ts,platform-jobs.ts}`, C `apps/api/src/platform/jobs/jobs.test.ts`
- M `apps/api/package.json`: dependency `pg-boss@^10`
- M `apps/api/src/platform/module.ts` (`Jobs` type)
**Steps**
1. `jobs.ts`: `createJobs(config, sql)` wraps `new PgBoss({ connectionString, schema: "platform_jobs" })`; exposes `start()`, `stop()`, `send(name, data, opts)`, `schedule(name, cron, data, { tz: "Asia/Dhaka" })`, `work(name, handler, { concurrency })`. In `ROLE=api` only `send` is used; in `ROLE=worker|all` call `work` for each registered handler.
2. `define.ts`: `defineJob<T>({ name, schema: z.ZodType<T>, handler, retryLimit = 5, retryBackoff = true, cron? })`. Each module exports `jobs: JobDefinition[]` from `modules/<m>/jobs.ts`; `app.ts` collects them from the registry.
3. `platform-jobs.ts` registers: `platform.outbox.drain` (every 5 seconds using a 1-second poll loop when `ROLE` includes worker; also invoked immediately after `publish` through `LISTEN outbox`), `platform.outbox.cleanup` (daily 03:00 Asia/Dhaka), `platform.integrity.check` (nightly 03:30, reports orphan rows per schema into `platform.health_checks`), `platform.jobs.deadletter-report` (hourly, writes counts to metrics).
4. Dead letters: pg-boss failed jobs after `retryLimit` stay in its archive; expose `deadLetterCount()` for T-PLAT-15.
5. Test-friendly mode: `createJobs` accepts `{ inline: true }` which runs handlers synchronously on `send` (used by module tests) and a `runDue()` helper that executes scheduled jobs whose time has come against an injected clock.
**Contract** — job names `module.verb-noun` (e.g. `budgeting.evaluate-alerts`); payload validated with Zod before the handler runs; handlers idempotent.
**Tests**
- `send then work executes once` (real pg-boss on the harness DB)
- `failed job retries with backoff then becomes dead`
- `schedule respects Asia/Dhaka` (inline clock)
- `inline mode runs handlers synchronously`
**Acceptance** — `pnpm test:db -- jobs` exits 0.
**Done when** — a module can add `defineJob` in `jobs.ts` and it runs under `ROLE=worker` with no other wiring.

---

### T-PLAT-10 · Rate limiter (database buckets) and Fastify plugin
- **Closes:** NFR-05, FR-AUTH-07 (infrastructure), FR-NUDGE-05, SRS §11.5, GAP-ARCH-06
- **Depends on:** T-PLAT-07
- **Milestone:** M0
- **Layer:** api
**Why** — OTP, buzz, messages, uploads and general API calls need limits that survive restarts and work across instances.
**Files**
- C `apps/api/src/platform/rate-limit/{limiter.ts,plugin.ts,schema.ts}`, C `apps/api/src/platform/rate-limit/limiter.test.ts`
**Steps**
1. Table `platform.rate_limits(key text, window_start timestamptz, count int, primary key (key, window_start))`; cleanup in `platform.outbox.cleanup` job (delete windows older than 2 days).
2. `Limiter.hit(key, { limit, windowSeconds }): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }>` using `INSERT ... ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1 RETURNING count` with `window_start = to_timestamp(floor(extract(epoch from now()) / windowSeconds) * windowSeconds)` (fixed window; good enough and cheap).
3. Convenience `Limiter.hitMany([...])` that checks several limits (for example 3/min and 20/hour) in one statement and returns the first that denies.
4. Fastify plugin registers a global `onRequest` limit: authenticated routes keyed `u:<userId>` 300/min; unauthenticated keyed `ip:<ip>` 60/min; `/health`, `/ready`, `/metrics`, `/v1/openapi.json` exempt. Route-level override via `config: { rateLimit: { key: (req) => string, limit, windowSeconds } }`.
5. Denied requests throw `tooManyRequests("rate_limited", retryAfterSeconds)` (T-PLAT-06).
6. In-memory implementation `MemoryLimiter` with the same interface for unit tests that need no DB.
**Contract** — limits in SRS §11.5 are constants in `platform/rate-limit/limits.ts` (`LIMITS.otpPerHour = { limit: 5, windowSeconds: 3600 }`, `LIMITS.nudgePerMinute`, …) so modules import the numbers, not literals.
**Tests**
- `allows up to the limit then denies with retryAfter`
- `windows reset`
- `hitMany reports the first violated limit`
- `plugin exempts health routes`
- `authenticated and unauthenticated buckets are separate`
**Acceptance** — `pnpm test:db -- rate-limit` and `pnpm --filter @amar-poribar/api test -- rate-limit` exit 0.
**Done when** — hitting `/v1/auth/otp/request` 61 times in a minute from one IP returns 429 with `Retry-After`.

---

### T-PLAT-11 · Feature flags
- **Closes:** SRS §1.5 rule 5, GAP-ARCH-08, `GET /v1/flags`
- **Depends on:** T-PLAT-07
- **Milestone:** M0
- **Layer:** api
**Why** — unfinished features ship dark; clients ask which are on.
**Files**
- C `apps/api/src/platform/flags/{flags.ts,schema.ts,routes.ts,flags.test.ts}`
- C `packages/shared/src/flags.ts` (names list) and M `packages/shared/src/index.ts`
**Steps**
1. Table `platform.feature_flags(name text pk, enabled boolean, description text, updated_at timestamptz)`.
2. `Flags.isOn(name, ctx?)`: precedence is env override (`FEATURE_FLAGS=comms_video=on`) → database row → default from `packages/shared/src/flags.ts` (`FLAG_DEFAULTS`). Cached 30 seconds.
3. Flag names declared in shared: `comms_nudge`, `comms_chat`, `comms_voice_notes`, `comms_video_messages`, `comms_video_calls`, `shopping`, `lending`, `billing`, `admin_console`, `simple_mode`, `receipts`, `ask`. All default `off` except `comms_nudge`, `comms_chat`, `simple_mode` which stay `off` until their milestone task flips the default.
4. `GET /v1/flags` returns `{ flags: Record<string, boolean> }` (no auth) with `Cache-Control: max-age=60`.
5. A route helper `requireFlag(name)` preHandler returns 404 `not_found` when off (so dark routes do not exist to clients).
**Tests** — `env override beats database`, `database beats default`, `cache expires`, `requireFlag returns 404 when off`.
**Acceptance** — `pnpm test:db -- flags` exits 0.
**Done when** — setting `FEATURE_FLAGS=comms_chat=on` turns on a route that uses `requireFlag("comms_chat")`.

---

### T-PLAT-12 · Object storage port and adapters (S3/MinIO, in-memory)
- **Closes:** DEC-07, GAP-ARCH-05, FR-TXN-07, FR-VNOTE-02
- **Depends on:** T-PLAT-04
- **Milestone:** M0
- **Layer:** api
**Why** — receipts, voice notes, video messages and export files need storage with short-lived URLs; tests must run without S3.
**Files**
- C `apps/api/src/platform/storage/{storage.ts,s3.ts,memory.ts,storage.test.ts}`
- M `apps/api/package.json`: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
**Steps**
1. Port: `interface ObjectStorage { presignPut(key, { contentType, maxBytes, expiresSeconds }): Promise<{ url, headers }>; presignGet(key, { expiresSeconds, downloadName? }): Promise<string>; head(key): Promise<{ bytes: number; contentType: string } | null>; delete(key): Promise<void>; deleteMany(prefix): Promise<number>; putObject(key, body, contentType): Promise<void> }`.
2. `s3.ts` adapter with `forcePathStyle: true` (MinIO) using `STORAGE_*` config; `presignPut` uses `PutObjectCommand` with `ContentLength` bounds enforced through a policy header `x-amz-content-length-range` when supported, otherwise the API re-checks size with `head` on confirm (contract: callers must always call `head`).
3. `memory.ts` adapter keeps bytes in a `Map`, returns fake URLs `memory://bucket/key?exp=…` and offers `__put(key, bytes)` so tests can simulate an upload.
4. Key layout helper `keys.ts`: `voice/{familyId}/{mediaId}.m4a`, `video/{familyId}/{mediaId}.mp4`, `receipt/{familyId}/{txnId}.jpg`, `export/{userId}/{requestId}.zip`. A test asserts every key starts with a family or user id (so deleting by prefix on erasure is possible).
5. Bucket lifecycle documented in `docs/runbooks/restore.md` (T-PLAT-34): abort incomplete multipart after 1 day.
**Tests** — `memory adapter round trip`, `presign expiry is clamped to 10 minutes for put and 5 for get`, `head returns null for missing`, `key helpers never produce paths without an owner id`; with MinIO (harness): `presigned put then head then get works`.
**Acceptance** — `pnpm --filter @amar-poribar/api test -- storage` and `pnpm test:db -- storage` exit 0.
**Done when** — the same test body passes against memory and MinIO.

---

### T-PLAT-13 · WebSocket hub with authentication and LISTEN/NOTIFY fan-out
- **Closes:** DEC-05, GAP-ARCH-04, SRS §5.4, FR-PRES-01 (infrastructure)
- **Depends on:** T-PLAT-08, T-PLAT-10
- **Milestone:** M0
- **Layer:** api
**Why** — buzz, chat, presence, shopping updates and call signalling all need one realtime path that works on one instance now and several later.
**Files**
- C `apps/api/src/platform/realtime/{hub.ts,protocol.ts,fanout.ts,plugin.ts,hub.test.ts}`
- M `apps/api/package.json`: `@fastify/websocket@^11`, `ws` types
**Steps**
1. Plugin registers `GET /v1/ws` (websocket). On connect start a 5-second auth timer; first frame must be `{ t:"auth", token, deviceId, familyId }` validated with the identity JWT verifier (`ctx.verifyAccessToken` injected by identity in T-PLAT-23; until then accept an injected function). Failure closes with code `4401`; timeout `4408`.
2. Hub state: `Map<userId, Set<Connection>>`, `Map<familyId, Set<userId>>`; `Connection { socket, userId, deviceId, familyId, lastPingAt }`. Heartbeat: expect `ping` at least every 60 s, reply `pong`; a sweeper closes dead sockets and emits `presence` offline when a user's last connection closes.
3. Public API (used by modules through `ctx.realtime`): `sendToUser(userId, frame)`, `sendToFamily(familyId, frame, { exceptUserId? })`, `isOnline(userId)`, `onlineUsers(familyId)`, `closeUser(userId, code)`, `subscribe(type, handler)` for client→server frames (modules register handlers; unknown types are ignored).
4. Fan-out across instances: `fanout.ts` publishes every outgoing frame that targets a user not connected locally with `SELECT pg_notify('realtime', $json)` (payload ≤ 7,000 bytes; larger frames are stored in `platform.realtime_payloads` and referenced by id), and every instance `LISTEN realtime` and delivers to its own connections. Dedupe by frame id.
5. Envelope and ack as in SRS §5.4: every frame has `t`, `id`, `ts`; client frames that change state get `ack` or `err`. Max frame size 16 KB; larger closes with `1009`.
6. Authorisation re-check: `Hub` subscribes to `families.MemberRemoved.v1` and `families.FamilySuspended.v1` (event bus) and drops the affected subscriptions.
7. Presence signals are published as `publishInProcess("realtime.presence", …)` for the comms module to consume later.
**Contract** — frame types table of SRS §5.4; close codes `4401` unauthorised, `4408` auth timeout, `4429` rate limit (60 frames/10 s), `4403` removed from family.
**Tests** (`hub.test.ts` with a real `ws` client against `app.listen({port:0})`)
- `rejects connection without auth frame in 5 seconds`
- `valid auth then ping gets pong`
- `sendToUser reaches all of the users sockets`
- `message from another instance arrives through NOTIFY` (two hubs on the same DB)
- `closing last socket emits offline presence`
- `removed member is disconnected`
- `frame over 16KB closes the socket`
**Acceptance** — `pnpm test:db -- realtime` exits 0.
**Done when** — two test clients on different hub instances exchange a frame through the database.

---

### T-PLAT-14 · OpenAPI generation, type provider and drift check
- **Closes:** DEC-17, SRS §5.3, GAP-ARCH-07
- **Depends on:** T-PLAT-06
- **Milestone:** M0
- **Layer:** api
**Why** — web, admin and mobile must share one machine-readable contract; the tenant-isolation test and Dart contract test read it.
**Files**
- C `apps/api/src/platform/openapi/{plugin.ts,build.ts}`, C `apps/api/scripts/build-openapi.ts`
- C `apps/api/openapi.json` (generated, committed)
- M `apps/api/package.json`: `fastify-type-provider-zod`, `@fastify/swagger`; script `"openapi:build": "tsx scripts/build-openapi.ts"`
- M root `package.json`: `"openapi:check": "pnpm --filter @amar-poribar/api openapi:build -- --check"`
**Steps**
1. In `app.ts` set `app.setValidatorCompiler(validatorCompiler); app.setSerializerCompiler(serializerCompiler)` from `fastify-type-provider-zod`, and register `@fastify/swagger` with `transform: jsonSchemaTransform`, OpenAPI 3.1, `info.version` from `package.json`, security scheme `bearerAuth`.
2. Do **not** convert all routes now. Add a helper `route(app, { method, url, schema: { params, querystring, body, response }, preHandler }, handler)` in `platform/http/route.ts` that new and moved routes use. Existing handlers that call `parseOr400` keep working; the move tasks (T-PLAT-23..30) convert each route to `route()` with schemas taken from `packages/shared` (`CreateTransactionSchema` etc.). Routes without schemas appear in the document with `x-undocumented: true` so the drift check lists them.
3. `GET /v1/openapi.json` returns `app.swagger()` (dev/test only unless `OPENAPI_PUBLIC=true`).
4. `build-openapi.ts`: builds the app with fakes and an in-memory db stub, writes `apps/api/openapi.json` with sorted keys; with `--check` compares to the committed file and exits 1 with a unified diff on mismatch.
5. Add `x-undocumented` counter to the script output; `pnpm openapi:check` prints it; a threshold file `apps/api/openapi-baseline.json` (`{ "undocumented": N }`) must never increase and must reach 0 by the end of T-PLAT-30 (the test in T-PLAT-31 enforces 0).
**Contract** — every moved route has `response` schemas for 2xx and the `ApiErrorSchema` for 4xx/5xx.
**Tests** — `openapi document contains all registered routes`, `every route has a bearerAuth requirement except an allow-list (auth, health, flags, invites preview)`, `openapi:check detects a changed schema` (script run in a temp copy).
**Acceptance** — `pnpm openapi:check` exits 0; `pnpm --filter @amar-poribar/api test -- openapi` exits 0.
**Done when** — changing a Zod schema in shared and not regenerating the file fails `pnpm openapi:check`.

---

### T-PLAT-15 · Health, readiness and metrics endpoints
- **Closes:** NFR-12, SRS §3.7, GAP-ARCH-06, FR-ADM-10 (data source)
- **Depends on:** T-PLAT-05, T-PLAT-09
- **Milestone:** M0
- **Layer:** api
**Why** — `/health` is the only probe today; Compose and CI need readiness, and system health (G4) needs numbers.
**Files**
- C `apps/api/src/platform/health/{health.ts,metrics.ts,routes.ts,health.test.ts}`
- M `apps/api/package.json`: `prom-client`
**Steps**
1. `GET /health` → `{ ok: true }` (unchanged, no I/O). `GET /ready` → checks `select 1`, migrations table not empty, job queue connected; returns 200 `{ ok: true, checks: {...} }` or 503 with the failing check names.
2. `metrics.ts` with `prom-client` default metrics plus: `http_request_duration_seconds{route,method,status}` histogram (route pattern label), `ws_connections` gauge, `outbox_pending` gauge, `jobs_dead_total` gauge, `rate_limited_total` counter, `ai_requests_total{feature,outcome}` counter (filled by the ai module later), `push_sent_total{provider,outcome}`, `otp_sent_total{outcome}`.
3. `GET /metrics` requires header `authorization: Bearer ${METRICS_TOKEN}` (404 when the token is unset in production). Also expose the same data as JSON through an internal function `snapshot()` used by the admin health module later.
4. A job `platform.health.sample` runs every minute and writes p95 latency, OTP delivery rate and push delivery rate into `platform.health_samples(at, key, value)` (kept 14 days) so FR-ADM-10 can chart it without Prometheus.
**Tests** — `health never touches db`, `ready returns 503 when db down` (closed pool), `metrics requires token`, `request histogram labels use route pattern`, `sample job writes rows`.
**Acceptance** — `pnpm --filter @amar-poribar/api test -- health` and `pnpm test:db -- health` exit 0; compose healthcheck uses `/ready` (T-PLAT-32).
**Done when** — stopping Postgres turns `/ready` red while `/health` stays green.

---

### T-PLAT-16 · Contract vectors for Dart and TypeScript (`packages/shared/test-vectors/api`)
- **Closes:** DEC-17, SRS §5.3, GAP-ARCH-07, GAP-MOB-14 (shared half)
- **Depends on:** T-PLAT-14
- **Milestone:** M0
- **Layer:** platform
**Why** — mobile models are hand-written. Shared fixtures make both sides fail together when a field changes.
**Files**
- C `packages/shared/test-vectors/api/` with one JSON file per response shape: `me.json`, `family.json`, `member.json`, `account.json`, `category.json`, `transaction.json`, `transaction-list.json`, `draft.json`, `parse-response.json`, `summary-month.json`, `monthly-ai-summary.json`, `budget-list.json`, `sync-request.json`, `sync-response.json`, `error.json`
- C `packages/shared/test-vectors/money.json`, `bangla-words.json`, `sms-parser.json` (move the table-driven cases currently inline in `packages/shared/src/money.test.ts`, `words.test.ts`, `packages/ai/src/sms.test.ts`)
- C `packages/shared/src/vectors.test.ts` — validates each API fixture against the Zod schema/OpenAPI response schema
- C `tools/gen-vectors.ts` — regenerates fixtures from the `tools/fixtures` builders (T-PLAT-20) and writes sorted JSON
- C `packages/shared/test-vectors/README.md` — how Dart tests load them (`apps/mobile/test/contract/` is created in T-MOB)
**Steps** — 1. Start with fixtures written by hand from the current API output (run `scripts/e2e.mjs` once, copy responses, strip ids). 2. `vectors.test.ts` loads `apps/api/openapi.json`, finds the 2xx schema for the matching operation and validates the fixture with `ajv`. 3. Each fixture includes `"_operation": "GET /v1/families/{familyId}/transactions"` so tests know which schema to use. 4. `tools/gen-vectors.ts --check` fails CI when committed fixtures differ from regenerated ones.
**Contract** — fixture files contain only synthetic data (Bangla names such as "রহিম পরিবার"); no real phone numbers.
**Tests** — `every fixture validates against openapi.json`, `money vectors still pass money.test`, `bangla word vectors still pass words.test`.
**Acceptance** — `pnpm --filter @amar-poribar/shared test` and `pnpm exec tsx tools/gen-vectors.ts --check` exit 0.
**Done when** — adding a required field to `TransactionDraftSchema` fails `vectors.test.ts` until the fixture is updated.

---

### T-PLAT-17 · Fakes for SMS gateway and FCM push (`tools/fakes`)
- **Closes:** SRS §1.5 rule 4, §5.5, GAP-ARCH-11, FR-AUTH-08 (test side), FR-NOT-01 (test side)
- **Depends on:** T-PLAT-04
- **Milestone:** M0
- **Layer:** platform
**Why** — login (OTP) and push must be testable and runnable in Compose with no credentials.
**Files**
- C `tools/fakes/package.json` (private workspace package `@amar-poribar/fakes`), add `tools/*` to `pnpm-workspace.yaml`
- C `tools/fakes/src/server.ts` — one small Fastify app that hosts all fakes on one port (default 4100)
- C `tools/fakes/src/sms.ts`, `tools/fakes/src/fcm.ts`
- C `apps/api/src/platform/ports/{sms-gateway.ts,push-sender.ts}` — interfaces only
- C `apps/api/src/platform/ports/fakes/{memory-sms.ts,memory-push.ts}` — in-process fakes for unit tests
**Steps**
1. Interfaces (owned by `platform/ports`, implemented by `identity/infra` and `notifications/infra` later):
   - `SmsGateway.send({ to, text, kind: "otp"|"invite" }): Promise<{ providerId: string; status: "queued"|"sent"|"failed" }>`
   - `PushSender.send({ token, platform: "android"|"web", data: Record<string,string>, notification?: {title, body, channelId?}, priority: "high"|"normal", ttlSeconds }): Promise<{ outcome: "ok"|"unregistered"|"retry"|"failed"; providerId? }>`
2. In-memory fakes keep arrays `sent[]`, expose `last()`, `clear()`, and `failNext(outcome)`.
3. HTTP fakes (for Compose and Playwright): `POST /sms/send` stores the message and returns `{ id, status }`; `GET /sms/messages?to=` lists; `POST /sms/__reset`. `POST /fcm/v1/projects/:p/messages:send` mimics FCM HTTP v1 (returns `{ name }`; returns 404 `UNREGISTERED` for tokens starting `dead-`); `GET /fcm/messages?token=`; `POST /fcm/__reset`.
4. Real adapters are written in T-ID (SMS) and T-NOTIF (FCM); they call the fake URL when `SMS_GATEWAY=fake`/`PUSH_PROVIDER=fake` and `FAKES_URL` is set (config key added here: `FAKES_URL` default `http://localhost:4100`).
**Contract** — fake HTTP shapes above; response times < 5 ms.
**Tests** — `sms fake stores and lists messages`, `fcm fake returns UNREGISTERED for dead- tokens`, `memory sms failNext produces failed status`.
**Acceptance** — `pnpm --filter @amar-poribar/fakes test` and `pnpm --filter @amar-poribar/fakes build` exit 0.
**Done when** — `node tools/fakes/dist/server.js` serves both fakes and passes its tests.

---

### T-PLAT-18 · Fakes for payments, Claude (recorded) and TURN configuration
- **Closes:** SRS §1.5 rule 4, §5.5, DEC-08, DEC-09, GAP-ARCH-11
- **Depends on:** T-PLAT-17
- **Milestone:** M0
- **Layer:** platform
**Why** — billing, AI and calls must run in CI without third parties.
**Files**
- C `tools/fakes/src/payments.ts` — fake bKash, Nagad, SSLCommerz
- C `tools/fakes/src/claude.ts` — recorded-response fake for the Anthropic Messages API
- C `tools/fakes/recordings/*.json` — response recordings keyed by a hash of (feature, normalised input)
- C `apps/api/src/platform/ports/{payment-gateway.ts,llm.ts}`; C `apps/api/src/platform/ports/fakes/{memory-payments.ts,memory-llm.ts}`
- C `infra/coturn/turnserver.conf` (used by Compose, T-PLAT-32)
**Steps**
1. `PaymentGateway` interface: `createCheckout({ amountPaisa, currency, reference, returnUrl }) → { checkoutUrl, providerPaymentId }`, `verifyWebhook(headers, rawBody) → { eventId, providerPaymentId, status: "paid"|"failed" } | null`, `refund(...)` (declared, not used yet).
2. Fake payment server routes: `POST /pay/:provider/checkout` returns `{ url: "<FAKES_URL>/pay/:provider/page/<id>", id }`; `POST /pay/:provider/__complete { id, status }` sends a signed webhook (HMAC-SHA256 with `FAKE_PAYMENT_SECRET`) to `PAYMENT_WEBHOOK_URL`; `POST /pay/:provider/__replay { id }` resends the same webhook (to test idempotency).
3. `llm.ts` port: `Llm.complete({ system, messages, jsonSchema?, tools?, maxTokens, effort }) → { text, toolCalls?, usage: { inputTokens, outputTokens }, stopReason }`. The existing `@amar-poribar/ai` package calls the Anthropic SDK directly; the port wraps it (`ai/infra/ClaudeClient` in T-AI). The fake returns the recording whose key matches or throws `NoRecordingError` listing the key (so a developer adds the recording).
4. `tools/fakes/recordings/` ships recordings for the parse cases in `packages/ai/src/*.test.ts` plus the AC-02 sentence.
5. `infra/coturn/turnserver.conf`: `use-auth-secret`, `static-auth-secret=${TURN_SECRET}`, `realm=amar.local`, `listening-port=3478`, `min-port=49160`, `max-port=49200`, `no-tls`, `no-cli`, `fingerprint`.
**Tests** — `payment complete sends signed webhook`, `replay sends identical event id`, `claude fake returns recording or lists missing key`.
**Acceptance** — `pnpm --filter @amar-poribar/fakes test` exits 0.
**Done when** — a script can run a checkout against the fake and receive a signed webhook.

---

### T-PLAT-19 · Database test harness (`pnpm test:db`) with per-test isolation
- **Closes:** NFR-11, GAP-ARCH-09
- **Depends on:** T-PLAT-07
- **Milestone:** M0
- **Layer:** api
**Why** — DB-backed tests are a TODO today; all later tasks need them.
**Files**
- C `apps/api/vitest.config.ts` — two projects: `unit` (`src/**/*.test.ts` excluding `*.db.test.ts`) and `db` (`src/**/*.db.test.ts`, `tests/**/*.test.ts`, single worker, `globalSetup`)
- C `apps/api/tests/support/{global-setup.ts,db-test.ts,app-test.ts}`
- M `apps/api/package.json`: scripts `"test": "vitest run --project unit"`, `"test:db": "vitest run --project db"`; root `"test:db": "pnpm --filter @amar-poribar/api test:db"`
- M `docker-compose.yml`: add profile `test` services `db-test` (postgres on 5433, tmpfs) and `minio-test` (T-PLAT-32 finalises)
**Steps**
1. `global-setup.ts`: read `TEST_DATABASE_URL` (default `postgres://amar:amar@localhost:5433/amar_test`); if unreachable, start it with `docker compose --profile test up -d db-test minio-test --wait`; create a template database `amar_template`, run migrations into it once (`runMigrations`).
2. `db-test.ts`: `withTestDb(fn)` creates `CREATE DATABASE test_<uuid> TEMPLATE amar_template`, passes `{ db, sql, url }`, drops it afterwards. Cost ≈ 100 ms per test file; tests inside a file share it and clean with `truncateAll()` (truncates every table in module schemas except `platform.schema_migrations`).
3. `app-test.ts`: `buildTestApp({ ... })` builds the full app with the fakes (`memory-sms`, `memory-push`, memory storage, `MemoryLimiter` unless the test asks for the DB limiter, inline jobs, fixed clock) and returns `{ app, db, fakes, login(phone), as(user) }` where `login` does the OTP flow using the memory SMS fake and returns tokens.
4. Enable the tests that T-PLAT-07..15 marked `skipIf(!process.env.TEST_DATABASE_URL)`: global setup now sets the variable.
5. Convert `apps/api/scripts/e2e.mjs` to Vitest in T-PLAT-31 (not here).
**Contract** — DB tests live in `*.db.test.ts` next to the code or in `apps/api/tests/`; unit tests must not need Docker.
**Tests** — `withTestDb isolates data between files`, `truncateAll keeps migration table`, `buildTestApp login helper returns working tokens` (after T-PLAT-23; until then the helper is written but its test is skipped).
**Acceptance** — `docker compose --profile test up -d --wait db-test && pnpm test:db` exits 0 on a clean machine; `pnpm test` (unit) still runs without Docker.
**Done when** — CI can run `pnpm test:db` with a Postgres service container.

---

### T-PLAT-20 · Fixture builders and `pnpm seed:dev`
- **Closes:** README "Test data", SRS §1.5 rule 7
- **Depends on:** T-PLAT-19
- **Milestone:** M0
- **Layer:** platform
**Why** — tests and the demo need the same realistic family without hand-written SQL.
**Files**
- C `tools/fixtures/package.json` (`@amar-poribar/fixtures`), `src/index.ts`, `src/families.ts`, `src/ledger.ts`, `src/comms.ts`, `src/users.ts`
- C `apps/api/scripts/seed-dev.ts`
- M root `package.json`: `"seed:dev": "pnpm --filter @amar-poribar/api exec tsx scripts/seed-dev.ts"`
**Steps**
1. Builders talk to the API through an injected client (`api.post`), **not** the database, so they respect module rules: `makeUser(api, { phone })` (uses the fake SMS to read the OTP), `makeFamily(api, owner, { name })`, `inviteAndJoin(api, owner, user, role)`, `makeTransactions(api, token, familyId, n, { seed })` (deterministic by seed, category and account mix, ~10% private), `makeBudgets`, later `makeConversation`.
2. `seed-dev.ts`: creates the demo family "রহিম পরিবার" with members আব্বু (owner, `01712345678`), আম্মু (admin, `01812345678`), দাদি (member, `01912345678`), তানভীর (viewer, `01612345678`), নুসরাত (member, `01512345678`), 2 accounts plus বিকাশ and নগদ, 120 transactions over 3 months, budgets, and (when comms exists) a conversation with messages. Idempotent: skips when phone `01712345678` already has a family named "রহিম পরিবার".
3. Print the dev login (phone numbers and "OTP is shown in the fake SMS list at http://localhost:4100/sms/messages").
4. Fixtures package exports `FIXTURE_PHONES` so tests do not repeat literals.
**Tests** (`tools/fixtures/src/*.test.ts`, DB harness) — `makeFamily creates seeded categories and cash account`, `makeTransactions is deterministic for a seed`, `seed-dev is idempotent`.
**Acceptance** — `pnpm test:db -- fixtures` and (with the stack up) `pnpm seed:dev && pnpm seed:dev` exit 0.
**Done when** — a fresh `docker compose up` followed by `pnpm seed:dev` yields a usable demo family.

---

### T-PLAT-21 · Automatic tenant-isolation test (SRS §11.2)
- **Closes:** NFR-06, AC-07, SRS §11.2
- **Depends on:** T-PLAT-14, T-PLAT-19, T-PLAT-20
- **Milestone:** M0
- **Layer:** api
**Why** — an outsider must get 404 on every family-scoped route, including routes added later.
**Files**
- C `apps/api/src/security/tenant-isolation.db.test.ts`
- C `apps/api/src/security/route-fixtures.ts` — per-route request builders
**Steps**
1. Load `apps/api/openapi.json`. Select operations whose path contains `{familyId}`, `{conversationId}`, `{messageId}`, `{mediaId}`, `{nudgeId}`, `{listId}`, `{txnId}`, `{inviteId}` (or any path parameter ending in `Id` that is not a user id).
2. Build two families A and B (fixtures) with one resource per route group. `route-fixtures.ts` maps `"METHOD /path"` to `(ctx) => ({ params, query, body })` for A's resources.
3. For every selected operation call it as a user from family B (member role) with A's ids and expect `404` and a body with `error.code === "not_found"`. Operations that legitimately return 403 for outsiders are listed in an explicit allow-list file `tenant-allowlist.json` with a reason.
4. Operations missing from `route-fixtures.ts` **fail** the test with the list of missing keys (so new routes force a fixture). Initially fixtures exist for all current routes; later tasks add theirs.
5. Also assert unauthenticated calls return 401, and that `x-request-id` is present on the 404.
**Tests** — `outsider gets 404 on <operation>` generated per operation (use `it.each`).
**Acceptance** — `pnpm test:db -- tenant-isolation` exits 0; deleting one fixture makes it fail with the missing key.
**Done when** — the test covers every route in `openapi.json` that has a family-scoped path parameter.

---

### T-PLAT-22 · `@staff-safe` ESLint rule and private-fields list (SRS §11.3)
- **Closes:** DEC-18, R6, FR-ADM-11, NFR-23
- **Depends on:** T-PLAT-03
- **Milestone:** M0
- **Layer:** api
**Why** — the admin module must provably see aggregates only.
**Files**
- C `packages/shared/src/private-fields.ts` — `export const PRIVATE_FIELDS = ["amountPaisa","feePaisa","note","counterparty","trxId","body","mediaId","storageKey","phone","token","fcmToken","email","personName","personPhone", ...] as const`
- C `tools/eslint-rules/staff-safe.mjs`, `tools/eslint-rules/staff-safe.test.mjs`
- M `eslint.config.mjs` — register local plugin `amar` and enable `amar/staff-safe-facade` for `apps/api/src/modules/*/index.ts`
- M `.dependency-cruiser.cjs` — complete rule `admin-staff-safe-only`
**Steps**
1. Convention: a facade function intended for staff has the JSDoc tag `@staff-safe` and a declared return type.
2. ESLint rule `staff-safe-facade`: for each exported function/method carrying `@staff-safe`, resolve the return type's property names (using the TypeScript type checker through `typescript-eslint` parser services) and fail if any property name, at any depth up to 4, is in `PRIVATE_FIELDS`, or if the return type contains `any`/`unknown`.
3. Dependency-cruiser rule `admin-staff-safe-only`: files in `modules/admin/**` may import only `modules/<m>/index.ts` for `m ∈ {families, billing, privacy, platform}`; additionally an ESLint rule `amar/admin-imports-only-staff-safe` checks that every imported symbol from those modules is a function tagged `@staff-safe` or a pure type.
4. The runtime crawl test (AC-31) is written in T-ADM; this task provides the static half.
**Tests** (`staff-safe.test.mjs` with ESLint `RuleTester`) — `fails when return type exposes amountPaisa`, `fails on nested note`, `fails on any`, `passes aggregate dto`, `admin importing an untagged function is reported`.
**Acceptance** — `pnpm lint` and `node --test tools/eslint-rules/staff-safe.test.mjs` exit 0.
**Done when** — tagging a function that returns `{ note: string }` with `@staff-safe` fails lint.

---

## Moving the existing code into modules (T-PLAT-23 .. T-PLAT-31)

Common rules for every move task:
1. **No behaviour change.** The unit tests in `app.test.ts` and the HTTP behaviour covered by `scripts/e2e.mjs` must stay identical. Move the relevant `describe` blocks from `app.test.ts` into the module's test files in the same pull request; leave a short `app.test.ts` for what remains until T-PLAT-31 deletes it.
2. Routes are converted to the `route()` helper (T-PLAT-14) with Zod schemas from `@amar-poribar/shared`; handler bodies stay the same.
3. Each module's tables move into its `schema.ts` using `pgSchema("<module>")`. Enums become `<module>Schema.enum(...)`. After each task run `pnpm db:generate -- --name dev-baseline-<module>` **only until T-PLAT-31**, then the baseline is regenerated once and frozen (no production database exists, so developers run `pnpm db:reset`).
4. Cross-module calls use the facade functions named below. A facade function is added in the owning module's `app/` use-case file and exported through `index.ts` with a typed DTO.
5. The route paths, status codes and response bodies do not change; the web app and the Flutter app keep working without edits.
6. `pnpm arch`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db` must pass at the end of each task.

---

### T-PLAT-23 · Move `identity` (auth, OTP, JWT)
- **Closes:** GAP-ARCH-01, R1–R8 for identity
- **Depends on:** T-PLAT-02, T-PLAT-03, T-PLAT-06, T-PLAT-07, T-PLAT-14, T-PLAT-19
- **Milestone:** M0
- **Layer:** api
**Why** — `routes/auth.ts`, `otp.ts` and the JWT half of `auth.ts` belong to one module, and every other module needs an authenticate hook that comes from it.
**Files**
- C `apps/api/src/modules/identity/http/auth.routes.ts` ← `src/routes/auth.ts` (`/v1/auth/otp/request`, `/v1/auth/otp/verify`, `/v1/auth/refresh`)
- C `apps/api/src/modules/identity/app/{issue-tokens.ts,request-otp.ts,verify-otp.ts,refresh.ts}` — split the inline logic of the three handlers (current `issueTokens(userId)` signs `{ sub, typ }` with `expiresIn` 15m/30d)
- C `apps/api/src/modules/identity/infra/{otp-store.memory.ts,jwt.ts}` ← `src/otp.ts` (class `OtpStore`, unchanged behaviour: 5 min expiry, 5 attempts) and `registerAuth` from `src/auth.ts`
- C `apps/api/src/modules/identity/schema.ts` ← table `users` (columns `id, phone, name, locale, bn_digits, created_at, updated_at`)
- C `apps/api/src/modules/identity/index.ts` — facade `IdentityFacade`:
  - `getUserBasics(userId): Promise<{ id, name, phone, locale, bnDigits } | null>`
  - `findUserByPhone(phone): Promise<{ id } | null>`
  - `getUsersBasics(ids): Promise<Map<string, {id,name}>>` (for member lists)
  - `verifyAccessToken(token): { userId }` (for the WebSocket hub)
  - `createUserIfMissing(phone): Promise<{ id }>` (used only inside identity)
- C `apps/api/src/modules/identity/{auth.routes.test.ts,otp-store.test.ts}` ← OTP cases in `app.test.ts`
- M `apps/api/src/app.ts` — `authenticate` decorator now registered by identity; declaration-merge `FastifyInstance.authenticate` and `FastifyRequest.user` in `platform/http/types.d.ts`
- M `apps/api/src/platform/realtime/plugin.ts` — inject `ctx.facades.identity.verifyAccessToken`
**Steps**
1. Create the schema file with `users` in `pgSchema("identity")`; keep column names and defaults.
2. Move `OtpStore` into `infra/otp-store.memory.ts` behind a port `OtpStore` (interface in `app/ports.ts`); the real DB-backed store arrives in T-ID-01.
3. `jwt.ts` registers `@fastify/jwt` and decorates `authenticate` exactly as `registerAuth` does today (401 `unauthorized` for missing/invalid, 401 for non-access tokens).
4. The three routes keep their bodies; the part of `/v1/auth/otp/verify` that inserts a user when missing calls `createUserIfMissing`. The `GET /v1/me` route is **not** moved here (see T-PLAT-24 step 6: it composes identity and families).
5. Replace `deps.otp`/`deps.isProd` usage with `ctx.config.isProd` and the OTP port.
6. Update `ModuleContext` creation in `app.ts` to carry `jwtSecret` through `ctx.config`.
7. Convert `AppDeps` consumers: `buildApp(deps)` signature changes in T-PLAT-31; until then keep `buildApp(deps: AppDeps)` and build the context from it.
**Contract** — unchanged routes; error bodies unchanged.
**Tests** — cases moved: `rejects non-Bangladeshi phone numbers`, `issues a dev OTP outside production`, `requires auth on family routes` (route belongs to families but the 401 comes from identity's hook; keep in `app.test.ts`), `otp expires`, `otp locks after 5 attempts`, `refresh rejects access token`.
**Acceptance** — `pnpm arch && pnpm typecheck && pnpm test && pnpm test:db -- identity` exit 0.
**Done when** — no file outside `modules/identity` imports `users` or `OtpStore`; `grep -rn "from \"../otp" apps/api/src` is empty.

---

### T-PLAT-24 · Move `families` (families, members, invites, roles)
- **Closes:** GAP-ARCH-01 for families
- **Depends on:** T-PLAT-23, T-PLAT-08
- **Milestone:** M0
- **Layer:** api
**Why** — membership and roles are the core of authorisation and every other module asks "is this user in this family with this role?".
**Files**
- C `apps/api/src/modules/families/schema.ts` ← tables `families`, `family_members`, `family_invites`; enum `role` (`ROLES` from shared)
- C `apps/api/src/modules/families/domain/roles.ts` ← `ROLE_RANK`, `canEditAll`, `canAssignRole`, `canManageMember` from `src/auth.ts` (pure functions, with their tests from `app.test.ts`)
- C `apps/api/src/modules/families/http/{families.routes.ts,invites.routes.ts,members.routes.ts}` ← `POST /v1/families` from `routes/families.ts`; invites routes from `routes/invites.ts` (`POST /v1/families/:familyId/invites`, `POST /v1/invites/:token/accept`); `GET /v1/families/:familyId/members`, `PATCH`/`DELETE …/members/:userId`
- C `apps/api/src/modules/families/app/{create-family.ts,create-invite.ts,accept-invite.ts,require-role.ts,list-members.ts}`
- C `apps/api/src/modules/families/events.ts` — `families.FamilyCreated.v1 { familyId, createdBy }`, `MemberJoined.v1`, `MemberRemoved.v1`
- C `apps/api/src/modules/families/index.ts` — facade `FamiliesFacade`:
  - `requireRole(familyId, userId, minRole): Promise<Role>` (404 for non-members, 403 for insufficient role — same as today)
  - `listFamiliesForUser(userId): Promise<FamilySummary[]>`
  - `getMemberIds(familyId): Promise<string[]>`
  - `getMemberRoles(familyId): Promise<Map<string, Role>>`
  - `getAiQuota(familyId): Promise<{ quotaMonth: number; plan: string }>` (temporary home; moves to billing in T-BILL)
  - role helpers re-exported: `canEditAll(role)`, `canAssignRole`, `canManageMember`
- C `apps/api/src/composition/me.routes.ts` — `GET /v1/me` assembling `identity.getUserBasics` + `families.listFamiliesForUser` (behaviour identical to the current handler in `routes/auth.ts`, response `{ id, phone, name, locale, bnDigits, families: [...] }`)
- C `apps/api/src/composition/index.ts`
- M `.dependency-cruiser.cjs` — rule `composition-allowed`
- C tests `modules/families/{roles.test.ts,families.routes.db.test.ts}` ← role cases in `app.test.ts`
**Steps**
1. Move tables; `family_invites.accepted_by` and `families.created_by` reference users: replace `.references(() => users.id)` with plain `uuid` columns (no cross-schema FK, DEC-02) and document with a comment `// identity.users.id`.
2. **Seeding on family creation.** Today `POST /v1/families` inserts the family, owner membership, seeded categories and two accounts in one request (`routes/families.ts` lines 27–41). The category/account seeding belongs to `ledger`. Implement: `create-family.ts` runs `db.transaction(tx => { insert family + member; bus.publish(tx, "families.FamilyCreated.v1", {...}) })`; `ledger` registers an **in-transaction subscriber** `ledger.seedDefaults` (T-PLAT-25) so the response still contains a family with seeded data. Until T-PLAT-25 lands, this task keeps the seeding code inline behind `ctx.facades.ledger?.seedDefaults ?? legacySeed` — remove the fallback in T-PLAT-25.
3. `accept-invite.ts`: phone-bound invites compare against `identity.getUserBasics(userId).phone` (replaces the join on `users`).
4. `members.routes.ts` list returns names from `identity.getUsersBasics(ids)` instead of joining `users`.
5. `requireRole` becomes `families.requireRole(familyId, userId, minRole)` (no `db` argument). Every later moved route calls `ctx.facades.families.requireRole`.
6. Add `src/composition/` as the documented exception (`R2` allows `composition/*` to import any facade); `app.ts` registers `meRoutes` after modules. Update the SRS note in T-PLAT-34.
7. Keep `GET /v1/me` behaviour byte-identical (test with a stored fixture `packages/shared/test-vectors/api/me.json`).
**Contract** — `FamilyCreated.v1 { familyId: string; createdBy: string; name: string }`.
**Tests** — moved: role-rule cases (`only owner assigns admin`, `nobody assigns owner`, `admin manages members but not admins`); new DB tests: `create family seeds owner membership`, `non-member gets 404 from requireRole`, `viewer fails member-level requireRole with 403`, `invite is single use`, `phone-bound invite rejects another phone`.
**Acceptance** — `pnpm arch && pnpm test && pnpm test:db -- families` exit 0; `git grep -n "familyMembers" apps/api/src | grep -v modules/families` prints nothing.
**Done when** — no module other than `families` touches `families`, `family_members` or `family_invites`.

---

### T-PLAT-25 · Move `ledger` (accounts, categories, transactions, totals, HLC stamping)
- **Closes:** GAP-ARCH-01 for ledger, GAP-REP-02 (shared visibility helper), FR-TXN-11
- **Depends on:** T-PLAT-24
- **Milestone:** M0
- **Layer:** api
**Why** — transactions are touched by seven routes today; one module must own them and offer queries to the others.
**Files**
- C `apps/api/src/modules/ledger/schema.ts` ← tables `accounts`, `categories`, `transactions`; enums `account_type`, `txn_type`, `txn_source`, `category_kind`; sequence `txn_sync_seq` as `ledgerSchema.sequence("txn_sync_seq")` and `bumpSyncSeq = sql\`nextval('ledger.txn_sync_seq')\``; the default of `transactions.sync_seq` updated to `nextval('ledger.txn_sync_seq')`
- C `apps/api/src/modules/ledger/http/{accounts.routes.ts,categories.routes.ts,transactions.routes.ts}` ← from `routes/families.ts` (accounts/categories CRUD) and `routes/transactions.ts`
- C `apps/api/src/modules/ledger/domain/{hlc.ts,month.ts,visibility.ts,seed-defaults.ts}` ← `src/hlc.ts` (with `hlc.test.ts`), `src/month.ts`, new `visibleToCaller(familyId, userId)` expression builder (the repeated `or(isPrivate=false, createdBy=user)` from five files), seed data from `@amar-poribar/shared` `DEFAULT_CATEGORIES` + the two default accounts
- C `apps/api/src/modules/ledger/app/{create-transaction.ts,update-transaction.ts,delete-transaction.ts,month-totals.ts,stamp-change.ts,list-for-sync.ts,apply-sync-change.ts,seed-defaults.ts}`
- C `apps/api/src/modules/ledger/events.ts` — `ledger.TransactionCreated.v1`, `Updated.v1`, `Deleted.v1` with payload `{ familyId, transactionId, type, amountPaisa, categoryId, occurredAt, isPrivate, createdBy }` (**payload may carry amount**: events are internal; staff never receive events)
- C `apps/api/src/modules/ledger/index.ts` — facade `LedgerFacade`:
  - `monthTotals(familyId, userId, month): Promise<MonthTotals>` (← `src/totals.ts`)
  - `expenseTotalBetween(familyId, userId, start, end): Promise<number>` (for festival budgets)
  - `listCategories(familyId): Promise<Category[]>`, `getCategoryByKey(familyId, key)`
  - `createTransaction(familyId, actor, input): Promise<Transaction>` (for recurring confirm)
  - `listForExport(familyId, userId, range): AsyncIterable<ExportRow>` (for CSV)
  - `remittanceByMonth(familyId, userId, from, to): Promise<...>` (for the remittance report)
  - `listChangesAfter(familyId, userId, role, seq, limit)` and `applyChange(familyId, userId, role, row)` (for sync; contain the merge now in `routes/sync.ts`)
  - `seedDefaults(tx, familyId)` (subscriber)
- C tests `modules/ledger/{hlc.test.ts,month.test.ts,transactions.routes.db.test.ts}` ← `hlc.test.ts`, `monthRange`/`dayRange` cases in `app.test.ts`
**Steps**
1. Move tables and enums into `ledgerSchema`; `account_type` uses `ACCOUNT_TYPES` from shared. Remove `.references(() => users.id)` and `.references(() => families.id)` (plain uuid columns with comments); keep intra-module references (`transactions.categoryId → categories.id`, `accountId → accounts.id`).
2. `stamp-change.ts` wraps `nextHlc(previous?)` and `bumpSyncSeq` so REST and sync paths stamp identically (FR-TXN-11): `stampChange(prevHlc?)` returns `{ hlc, syncSeq: sql\`nextval(...)\`, updatedAt }`.
3. Move the handlers of `routes/transactions.ts` verbatim into use cases; keep `assertOwnedRefs`, `visibleTo`, the TODO about cursor pagination (T-LED-01 implements it), and `limit(200)`.
4. `ledger.seedDefaults(tx, familyId)` inserts the default categories and the Cash account (as `routes/families.ts` does now; check the current seed: 20+ categories and 2 accounts) and is registered with `bus.onInTx("families.FamilyCreated.v1", …)`. Remove the legacy fallback added in T-PLAT-24.
5. Publish `TransactionCreated/Updated/Deleted` with `bus.publish(tx, …)` inside the use cases. No subscriber exists yet; the outbox rows are drained and marked done.
6. Replace uses of `monthTotals` imports in other modules by `ctx.facades.ledger.monthTotals` in their own move tasks (they still import `../totals.js` until then; this task leaves `src/totals.ts` as a re-export to keep the build green).
7. Convert both existing tests that touch `nextHlc` to the new path and keep `hlc.test.ts` using the shared vectors.
**Contract** — HTTP unchanged. Event payload above; `TransactionCreated` is published once per created row (also for rows created by sync; sync publishes after merge).
**Tests** — moved unit tests plus DB: `create transaction publishes an outbox event`, `private rows are visible only to creator`, `duplicate trxId returns 409`, `member cannot edit others entry`, `seedDefaults runs inside the family creation transaction` (kill the transaction → no family and no categories), `monthTotals matches e2e expectations`.
**Acceptance** — `pnpm arch && pnpm test && pnpm test:db -- ledger` exit 0; `git grep -nE "schema\.(transactions|accounts|categories)|from \"(\\.\\./)+db/schema" apps/api/src | grep -v modules/ledger` lists only modules still being moved (empty after T-PLAT-30).
**Done when** — `POST /v1/families` followed by `GET …/categories` returns the same seeded categories as before.

---

### T-PLAT-26 · Move `budgeting` (monthly budgets, festival budgets, level logic)
- **Closes:** GAP-ARCH-01 for budgeting
- **Depends on:** T-PLAT-25
- **Milestone:** M0
- **Layer:** api
**Files**
- C `apps/api/src/modules/budgeting/schema.ts` ← tables `budgets`, `festival_budgets` (unique index `budget_family_cat_month_uidx`)
- C `apps/api/src/modules/budgeting/domain/budget-level.ts` ← `src/budgets.ts` (`budgetLevel`, `effectiveBudgets`, `BudgetRow`) with its tests from `app.test.ts`
- C `apps/api/src/modules/budgeting/http/{budgets.routes.ts,festivals.routes.ts}` ← `routes/budgets.ts` (`GET`/`PUT /v1/families/:familyId/budgets`) and `routes/festivals.ts` (CRUD `…/festival-budgets`)
- C `apps/api/src/modules/budgeting/app/{get-budgets.ts,put-budgets.ts,festival-usecases.ts}`
- C `apps/api/src/modules/budgeting/events.ts` — declares `budgeting.BudgetThresholdCrossed.v1 { familyId, budgetId, categoryId|null, month, threshold: 80|100, spentPaisa, limitPaisa }` (type only; the alert engine is T-BUD-02)
- C `apps/api/src/modules/budgeting/index.ts` — facade `BudgetingFacade`: `getBudgetSummary(familyId, userId, month)`, `listFestivalBudgets(familyId, userId)` (for later notifications/admin)
- C tests `modules/budgeting/{budget-level.test.ts,budgets.routes.db.test.ts}`
**Steps**
1. Replace `monthTotals(db, …)` by `ctx.facades.ledger.monthTotals(familyId, userId, month)`.
2. Festival spending (`routes/festivals.ts` runs its own `select … from transactions`) → `ledger.expenseTotalBetween(familyId, userId, start, end)`; keep `dayRange` from `ledger/domain/month` through a re-export in the ledger facade (`ledger.dayRange`) or move `month.ts` into `platform/time/month.ts` now and import it everywhere (**choose this**; also update ledger).
3. Replace `categories` join (to return category names in the budget list) by `ledger.listCategories(familyId)` and a map in the use case.
4. Routes call `families.requireRole`.
**Tests** — moved: `budgetLevel` boundaries (ok < 80%, warning ≥ 80%, exceeded ≥ 100%), `effectiveBudgets inherits last month`; DB: `put then get budgets`, `viewer cannot put budgets`, `festival spend counts only the range`.
**Acceptance** — `pnpm arch && pnpm test && pnpm test:db -- budgeting` exit 0.
**Done when** — `routes/budgets.ts` and `routes/festivals.ts` are deleted.

---

### T-PLAT-27 · Move `recurring`
- **Closes:** GAP-ARCH-01 for recurring
- **Depends on:** T-PLAT-25
- **Milestone:** M0
- **Layer:** api
**Files**
- C `apps/api/src/modules/recurring/schema.ts` ← `recurring_templates`
- C `apps/api/src/modules/recurring/domain/schedule.ts` ← `src/recurring.ts` (`dueDateIn`, `isDueIn`, `reminderState`, `RecurringLike`) and its tests
- C `apps/api/src/modules/recurring/http/recurring.routes.ts` ← `routes/recurring.ts` (`GET/POST/PATCH /recurring`, `GET /recurring/drafts`, `GET /recurring/reminders`, `POST /recurring/:recurringId/confirm`)
- C `apps/api/src/modules/recurring/app/{list-drafts.ts,confirm-draft.ts,reminders.ts,templates.ts}`
- C `apps/api/src/modules/recurring/events.ts` — type `recurring.BillDue.v1 { familyId, templateId, name, dueDate, amountPaisa }` (emitted by T-REC-02)
- C `apps/api/src/modules/recurring/index.ts` — facade `RecurringFacade`: `listDueReminders(today)` (for the notifications job)
**Steps**
1. `confirm-draft.ts` currently inserts into `transactions` directly (with `nextHlc()`); replace with `ledger.createTransaction(familyId, { userId, role }, input)` returning the row; set `lastConfirmedMonth` in the same use case (not atomic across modules: confirmation order is ledger first, then update; make the update idempotent and re-checkable by `lastConfirmedMonth`).
2. Validate that `categoryId` and `accountId` on templates belong to the family through `ledger.assertOwnedRefs(familyId, refs)` (new facade function, extracted from `transactions.ts`).
3. Replace `accounts`/`categories` selects by the facade.
**Tests** — moved: `dueDateIn clamps day 31 to month end`, `isDueIn respects start and end`, `reminderState days until due`; DB: `confirm creates exactly one transaction for the month`, `second confirm is rejected`, `template with foreign category is rejected`.
**Acceptance** — `pnpm arch && pnpm test && pnpm test:db -- recurring` exit 0.
**Done when** — `routes/recurring.ts` and `src/recurring.ts` are deleted.

---

### T-PLAT-28 · Move `ai` (parse, receipt, ask, summary, quota)
- **Closes:** GAP-ARCH-01 for ai
- **Depends on:** T-PLAT-25, T-PLAT-18
- **Milestone:** M0
- **Layer:** api
**Files**
- C `apps/api/src/modules/ai/schema.ts` ← `ai_usage`, `ai_summaries`
- C `apps/api/src/modules/ai/http/ai.routes.ts` ← `routes/ai.ts` (`POST …/ai/parse`, `GET …/ai/summary`, `POST …/ai/ask`, `POST …/ai/receipt`)
- C `apps/api/src/modules/ai/app/{parse.ts,summary.ts,ask.ts,receipt.ts,quota.ts}`
- C `apps/api/src/modules/ai/infra/{claude-client.ts,ask-tools.ts}` — Anthropic SDK construction moves here from `server.ts` (`new Anthropic({ apiKey })`), behind the `Llm` port from T-PLAT-18 where the `@amar-poribar/ai` functions accept a client
- C `apps/api/src/modules/ai/index.ts` — facade `AiFacade`: `getUsage(familyId, month)` (for later `GET /ai/usage` and admin)
- C tests `modules/ai/{quota.db.test.ts,ai.routes.test.ts}`
**Steps**
1. `hasAiQuota(db, familyId)` (current inline function): quota from `families.getAiQuota(familyId)` (facade) and usage from this module's own `ai_usage`.
2. Categories for the parse prompt: `ledger.listCategories(familyId)` (the route currently selects `categories`); `transactions` reads inside `AskTools` (`sum_by_category`, `list_transactions`, `compare_months`) become `ledger.*` facade queries. If no existing facade fits, add `ledger.askQueries(familyId, userId)` returning an object with those three read-only functions (visibility rules applied inside ledger).
3. `monthTotals` for summary: `ledger.monthTotals`.
4. Keep behaviour: when `ANTHROPIC_API_KEY` is unset only the SMS parser runs and summary uses the template (this is covered by existing tests; keep them).
5. `ai_summaries` primary key `(family_id, month, locale, facts_hash)` unchanged.
**Tests** — keep `packages/ai` tests; add `ai.routes.test.ts` (no DB; fake `Llm`): `parse uses sms parser without calling the model`, `quota exhausted returns 429 ai_quota`, `summary falls back to template without a key`; DB: `usage row increments once per call`.
**Acceptance** — `pnpm arch && pnpm test && pnpm test:db -- ai` exit 0.
**Done when** — `routes/ai.ts` is deleted and no import of `@anthropic-ai/sdk` remains outside `modules/ai/infra` and `server.ts` composition.

---

### T-PLAT-29 · Move `reporting` (summary, remittances, CSV export)
- **Closes:** GAP-ARCH-01 for reporting
- **Depends on:** T-PLAT-25
- **Milestone:** M0
- **Layer:** api
**Files**
- C `apps/api/src/modules/reporting/http/reports.routes.ts` ← `routes/reports.ts` (`GET …/reports/summary`, `GET …/reports/remittances`, `GET …/reports/export.csv`)
- C `apps/api/src/modules/reporting/domain/csv.ts` ← `src/csv.ts` (`csvCell`, `csvRow`, `paisaToDecimal`, `dhakaStamp`) with the CSV cases from `app.test.ts`
- C `apps/api/src/modules/reporting/app/{month-summary.ts,remittances.ts,export-csv.ts}`
- C `apps/api/src/modules/reporting/schema.ts` (empty: this module has no tables; keep the file for R9)
- C `apps/api/src/modules/reporting/index.ts` — facade `ReportingFacade`: `monthSummary(familyId, userId, month)`
**Steps**
1. `month-summary.ts` uses `ledger.monthTotals` for both months (current code calls `monthTotals` twice via `Promise.all`).
2. `remittances.ts` replaces the raw SQL on `transactions` and the join to `categories` by `ledger.remittanceByMonth(familyId, userId, from, to)`; the `to_char(... at time zone 'Asia/Dhaka')` grouping moves into that ledger query.
3. `export-csv.ts` streams rows from `ledger.listForExport(...)`; header row and BOM unchanged; filename `amar-poribar-<from>-<to>.csv` unchanged.
4. `viewer` handling: reports allow `viewer` role (as now).
**Tests** — moved: `csvCell escapes quotes and commas`, `paisaToDecimal formats paisa`, `dhakaStamp uses +06:00`; DB: `summary excludes other members private rows`, `remittance window defaults to six months`, `range over 24 months returns 400`, `csv export matches fixture`.
**Acceptance** — `pnpm arch && pnpm test && pnpm test:db -- reporting` exit 0.
**Done when** — `routes/reports.ts`, `src/csv.ts`, `src/totals.ts` are deleted.

---

### T-PLAT-30 · Move `sync`
- **Closes:** GAP-ARCH-01 for sync, GAP-ARCH-09 (sync tests against a real DB)
- **Depends on:** T-PLAT-25
- **Milestone:** M0
- **Layer:** api
**Files**
- C `apps/api/src/modules/sync/http/sync.routes.ts` ← `routes/sync.ts` (`POST /v1/families/:familyId/sync`, `bodyLimit` 2 MB)
- C `apps/api/src/modules/sync/app/sync-exchange.ts` — cursor handling, validation, paging (`PAGE = 500`), clock-drift probe (`receiveHlc`, `ClockDriftError`), rejection reasons
- C `apps/api/src/modules/sync/domain/cursor.ts` — parse/format of the opaque cursor (`Number(body.cursor)` today)
- C `apps/api/src/modules/sync/schema.ts` (empty)
- C `apps/api/src/modules/sync/index.ts` — facade `SyncFacade` (empty for now)
- C tests `modules/sync/{sync.routes.db.test.ts,cursor.test.ts}` ← sync cases in `app.test.ts` (schema parse cases for `SyncRequestSchema`/`SyncTransactionSchema`)
**Steps**
1. Replace the inline `transactions` reads/writes with `ledger.listChangesAfter(...)` and `ledger.applyChange(...)`. The per-row `db.transaction` with `FOR UPDATE` (savepoint per row) and `isUniqueViolation` move to `ledger/app/apply-sync-change.ts` unchanged. `ledger.applyChange` returns `{ outcome: "applied"|"ignored", reason?: RejectReason }`.
2. Keep the 24-hour clock drift check in sync (it depends on HLC parsing from `ledger/domain/hlc.ts` — import through `ledger` facade `ledger.parseHlc/receiveHlc` or move `hlc.ts` to `platform/hlc.ts`; **choose** `platform/hlc.ts` now, keeping `apps/api/src/hlc.ts` as a re-export deleted in T-PLAT-31, and update ledger imports).
3. Role rules (viewers neither push nor receive) stay in the use case (`families.requireRole(..., "member")`).
4. Publish `ledger.TransactionCreated/Updated/Deleted` for applied rows (inside `applyChange`) so later budget alerts see synced changes.
**Tests** (DB, converted from the manual e2e script) — `first sync returns everything`, `second sync with returned cursor returns nothing`, `older HLC loses to newer`, `same push twice is idempotent`, `clock drift over 24h is rejected`, `duplicate trxId is rejected for one row only`, `private rows return only to creator`, `viewer cannot sync`, `more=true paging with 1200 rows`.
**Acceptance** — `pnpm arch && pnpm test:db -- sync` exit 0; the Flutter `sync_service_test.dart` still passes (`cd apps/mobile && flutter test test/data/sync_service_test.dart`).
**Done when** — `routes/sync.ts` is deleted.

---

### T-PLAT-31 · Cleanup: new `app.ts`, `server.ts`, worker entry, baseline migration freeze, e2e conversion
- **Closes:** GAP-ARCH-01, GAP-ARCH-02, GAP-ARCH-09, R8
- **Depends on:** T-PLAT-23..30, T-PLAT-09, T-PLAT-13, T-PLAT-15, T-PLAT-10, T-PLAT-11, T-PLAT-12
- **Milestone:** M0
- **Layer:** api
**Why** — until now old and new structure coexist. This task removes the old files, makes the module registry the only wiring, and freezes the baseline migration.
**Files**
- M `apps/api/src/app.ts` — `buildApp(options: { config, db, deps? })`: creates the platform services (`logger`, `bus`, `jobs`, `storage`, `flags`, `limiter`, `realtime`), the `ModuleContext`, registers plugins (cors, rate-limit, openapi, health, flags, websocket), loops over `modules` from `modules/registry.ts`, then `composition` routes, then `registerErrorHandler`
- M `apps/api/src/server.ts` — `loadConfig` → `createDb` → `runMigrations` → `buildApp` → `listen`; handles `SIGTERM` (close server, stop jobs, close db); honours `ROLE`
- C `apps/api/src/worker.ts` — same bootstrap with `ROLE=worker`: runs jobs and the outbox drainer without listening on HTTP except a tiny `/health` port 4001
- D `apps/api/src/routes/` (all files), `apps/api/src/{auth.ts,otp.ts,budgets.ts,csv.ts,recurring.ts,totals.ts,month.ts,hlc.ts,errors.ts,env.ts}`, `apps/api/src/db/{client.ts,schema.ts}`, `apps/api/scripts/e2e.mjs`
- C `apps/api/tests/e2e/{families.db.test.ts,ledger.db.test.ts,budgets.db.test.ts,recurring.db.test.ts,reports.db.test.ts,sync.db.test.ts,roles.db.test.ts}` — the content of `scripts/e2e.mjs` converted to Vitest using `buildTestApp` (each former `ok(...)` check becomes an `expect`)
- M `apps/api/drizzle/` — regenerate the baseline: `pnpm db:reset` then `rm -rf apps/api/drizzle && pnpm db:generate --name baseline` and keep `0000_schemas.sql` first; commit
- C `apps/api/drizzle/README.md` — "Baseline frozen at M0. Never edit existing migrations."
- M `apps/api/package.json` — remove `"e2e"` script and `"db:push"`
- C `apps/api/src/architecture.test.ts` additions: `no files remain in src/routes`, `no file imports src/db/schema`, `openapi undocumented count is 0`
- M `apps/api/openapi-baseline.json` → `{ "undocumented": 0 }`
**Steps**
1. Delete the old files listed above after `git grep` shows no importer.
2. Convert `app.test.ts` leftovers (health, CORS, auth requirement) into `platform/http/app.test.ts`; delete `app.test.ts`.
3. `buildApp` creates the AI client from `config.anthropicApiKey` (moved from `server.ts`), wires production adapters by config (`SMS_GATEWAY`, `PUSH_PROVIDER`, storage, payments) and the fakes otherwise.
4. Graceful shutdown test: `app.close()` closes websocket hub, jobs and pool without hanging.
5. Regenerate the OpenAPI document and vectors: `pnpm --filter @amar-poribar/api openapi:build && pnpm exec tsx tools/gen-vectors.ts`.
6. Run the full verification below; fix leftovers without changing behaviour.
**Contract** — API behaviour identical to commit `e2ef7bc` (checked by the converted e2e tests and `me.json` vector).
**Tests** — the converted e2e files (about 60 checks), `server boots with ROLE=worker and does not listen`, `SIGTERM closes cleanly`.
**Acceptance** — `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db && pnpm arch && pnpm openapi:check && pnpm db:check` exit 0; `test ! -d apps/api/src/routes`.
**Done when** — `apps/api/src` contains only `app.ts`, `server.ts`, `worker.ts`, `modules/`, `platform/`, `composition/`, `security/`, `architecture.test.ts`.

---

### T-PLAT-32 · Docker image targets and Compose stack (db, minio, coturn, fakes, api, worker, web, admin)
- **Closes:** SRS §3.7, GAP-ARCH-10 (compose part), NFR-20
- **Depends on:** T-PLAT-31, T-PLAT-17, T-PLAT-18
- **Milestone:** M0
- **Layer:** platform
**Why** — the stack must start with one command, without credentials, and include everything later milestones need.
**Files**
- M `Dockerfile` — add targets `worker` (same build as `api`, `CMD ["node","dist/worker.js"]`), `admin` (Next standalone, port 3100), `fakes` (`node tools/fakes/dist/server.js`); copy `tools/fakes/package.json`, `apps/admin/package.json` (created by T-ADMUI-01; the `COPY` line is guarded by creating a stub `apps/admin/package.json` in this task if absent)
- M `docker-compose.yml`:
  - `db` (as now) with healthcheck; `db-test` (profile `test`, port 5433, tmpfs)
  - `minio` (`minio/minio`, `server /data --console-address :9001`, creds `amar`/`amarsecret`), `minio-init` one-shot creating bucket `amar` with `mc`
  - `coturn` (`coturn/coturn`, mounts `infra/coturn/turnserver.conf`, ports 3478/udp+tcp and the relay range)
  - `fakes` (target `fakes`, port 4100)
  - `api` (target `api`, env from `.env.compose`, `depends_on: db healthy, minio-init completed, fakes started`), healthcheck `wget -qO- http://localhost:4000/ready`
  - `worker` (target `worker`, `ROLE=worker`)
  - `web` (as now), `admin` (target `admin`, port 3100, profile `admin` until T-ADMUI exists)
  - remove the `migrate` service: migrations run in `api`/`worker` startup (`MIGRATE_ON_START=true` for `api` only)
- C `.env.compose` (committed defaults; no secrets: dev JWT secret is generated at start via `JWT_SECRET: ${JWT_SECRET:-dev-only-secret-change-me-0123456789abcdef}`; production check in config rejects this value)
- M `.dockerignore` (keep `apps/mobile`, add `docs`)
**Steps**
1. Replace the `migrate` service and every `drizzle-kit push` mention.
2. Use `depends_on` conditions and `healthcheck` for every service so `docker compose up --wait` returns only when all are healthy.
3. Provide `pnpm stack:up` (`docker compose up -d --build --wait`) and `pnpm stack:down` (`docker compose down -v`) root scripts.
4. Smoke script `tools/smoke.sh`: `curl -fsS localhost:4000/ready`, `curl -fsS localhost:3000`, `curl -fsS localhost:4100/sms/messages`, `curl -fsS localhost:4000/v1/flags`, and a login+create-family round trip using the fake SMS list (this replaces the CI `curl` lines).
**Tests** — `tools/smoke.sh` is the test; `docker compose config -q` validates the file.
**Acceptance** — `docker compose config -q && pnpm stack:up && bash tools/smoke.sh && pnpm stack:down` exits 0 on a clean machine within 3 minutes (NFR-20; the script prints elapsed seconds and fails above 180).
**Done when** — `grep -n "drizzle-kit push" docker-compose.yml Dockerfile` prints nothing.

---

### T-PLAT-33 · CI rewrite, coverage gates and `pnpm verify:m0 … verify:m8`
- **Closes:** NFR-11, NFR-20, NFR-21, NFR-24, GAP-ARCH-10
- **Depends on:** T-PLAT-31, T-PLAT-32
- **Milestone:** M0
- **Layer:** platform
**Why** — CI is the only gate (SRS §1.5). It must run every check, block on Flutter analysis, enforce coverage, and give each milestone one command.
**Files**
- M `.github/workflows/ci.yml` — jobs below
- C `tools/verify.mjs` — milestone runner
- M root `package.json` — scripts `verify:m0 … verify:m8` → `node tools/verify.mjs m0` …, `coverage`
- C `apps/api/vitest.coverage.config.ts` (thresholds), C `packages/shared/vitest.config.ts` (thresholds), C `packages/ai/vitest.config.ts`
- C `apps/mobile/coverage_gate.sh` — parses `coverage/lcov.info` and checks ≥ 70% for `lib/domain`, `lib/data`, `lib/core`
- M `apps/mobile/analysis_options.yaml` if needed to make `flutter analyze` pass with zero issues
**Steps**
1. **Jobs** (all required):
   - `ts-static`: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm arch`, `pnpm arch:negative`, `pnpm openapi:check`, `pnpm db:check`, `pnpm exec tsx tools/gen-vectors.ts --check`, `node --test tools/eslint-rules/`.
   - `ts-test`: service container `postgres:16-alpine` and `minio`; `pnpm test`, `pnpm test:db`; coverage via `vitest --coverage` with thresholds: API `src/modules/**/{domain,app}/**` lines ≥ 80%, `packages/*` ≥ 70% (NFR-11); upload the report.
   - `build`: `pnpm build`.
   - `stack`: `pnpm stack:up`, `bash tools/smoke.sh`, logs on failure, `pnpm stack:down`.
   - `mobile`: `subosito/flutter-action` pinned to a version in `.flutter-version`; `flutter pub get`; `dart run build_runner build --delete-conflicting-outputs`; `flutter analyze` **without** `continue-on-error`; `flutter test --coverage`; `bash coverage_gate.sh`; contract test `flutter test test/contract` (added in T-MOB).
   - `e2e-web` and `e2e-admin`: Playwright against the compose stack (steps added by T-WEB/T-ADMUI; this task creates the jobs with `if: hashFiles('apps/web/e2e/**') != ''`).
   - `docs`: `node tools/check-docs.mjs` (T-PLAT-34).
   - `milestone`: matrix `[m0..m8]` running `pnpm verify:${{ matrix.m }}` with `continue-on-error: true` only for milestones whose tag file `milestones/<m>.done` is absent; the current milestone is the highest-numbered passing one reported in the job summary. (No human gate: a failing future milestone does not block merges; the current and earlier ones do.)
2. `tools/verify.mjs mN`: a table `MILESTONES = { m0: [commands], m1: [...] }` executed sequentially; each command printed with duration; exits non-zero at the first failure. `m0`: the whole `ts-static`, `ts-test`, `stack` command set. `m1…m8`: previous milestone plus the acceptance test IDs of SRS §13.1 (`pnpm test:db -- -t "AC-12"` etc.; tests are tagged with their AC id in the title, e.g. `it("AC-12 otp limits …")`). Later task files append to this table when they add AC tests.
3. Pin tool versions: `.node-version`, `.flutter-version`, `packageManager` already pins pnpm.
4. Concurrency group stays (`cancel-in-progress`). Total wall time target ≤ 20 min (NFR-20): run jobs in parallel; cache pnpm, pub, Docker layers (`docker/build-push-action` with GHA cache).
5. Add a CI step that fails when `docker-compose.yml`, `Dockerfile` or workflow files contain `drizzle-kit push`.
**Contract** — `pnpm verify:m0` is the single local command equal to the M0 gate.
**Tests** — `tools/verify.test.mjs`: `unknown milestone exits 2`, `fails on first failing command`, `lists commands in order`.
**Acceptance** — `pnpm verify:m0` exits 0; a pull request with a deliberate import across modules fails the `ts-static` job.
**Done when** — `flutter analyze` is blocking and all jobs are required in branch protection (documented in `docs/runbooks/ci.md`, created here).

---

### T-PLAT-34 · Documentation tasks: BRD v0.3, runbooks, SRS cross-checks, docs checker
- **Closes:** GAP-DOC-01, GAP-DOC-02, GAP-ARCH-12, SRS §11.4 (breach runbook), NFR-08
- **Depends on:** T-PLAT-31
- **Milestone:** M0
- **Layer:** docs
**Files**
- M `docs/BRD.md` — version 0.3; add BR-25..BR-30 exactly as SRS §14.2; update scope (§5.1 phases): add family communication, admin console, shopping list, privacy workflows, Simple mode; add risks (call quality on 4G, FCM unavailable, media storage cost), dependencies (FCM, S3, coturn, payment gateways); update glossary (Buzz, Facade)
- M `docs/SRS.md` — §3.2 add the `composition/` folder and its R2 exception (decision from T-PLAT-24); keep §13 in sync with `tools/verify.mjs`
- C `docs/runbooks/breach.md` — detection (audit log, health), containment (revoke sessions, rotate `JWT_SECRET`, disable flags), PDPO notification steps and timelines, evidence capture commands, post-incident checklist
- C `docs/runbooks/restore.md` — daily backup schedule (14 days), restore command sequence into a scratch database, weekly automated restore test script description, object storage lifecycle (abort incomplete uploads after 1 day; delete `voice/` and `video/` after 180 days)
- C `docs/runbooks/ci.md` — job list and required checks
- C `tools/check-docs.mjs`, C `tools/check-docs.test.mjs`
- C `tools/restore-test.sh` — creates a scratch DB, restores the latest `pg_dump` (path given by `BACKUP_FILE`), runs a row-count sanity query, prints `RESTORE_OK`
**Steps**
1. `check-docs.mjs` verifies, failing with a list: (a) the files above exist; (b) every `FR-…` ID in `docs/SRS.md` appears in at least one task file (`docs/tasks/*.md`) as `Closes:` entry — until all task files exist the checker runs in `--warn` mode (exit 0, prints missing) and switches to strict when `docs/tasks/05-web-admin.md` exists; (c) every `T-…` ID referenced in the SRS exists as a heading in `docs/tasks`; (d) every screen code listed in SRS §5.1.3 is mentioned in `docs/tasks/04-mobile.md` or `05-web-admin.md`; (e) the BRD version line contains `0.3`.
2. Write BR-25..BR-30 rows with the same IDs, priorities and phases as SRS §14.2.
3. In BRD §8 resolve the voice-entry-vs-plan conflict as in DEC-10 (device voice entry stays free).
**Tests** — `check-docs.test.mjs`: `reports missing runbook`, `reports unknown task id`, `warn mode exits 0`.
**Acceptance** — `node tools/check-docs.mjs --warn` and `node --test tools/check-docs.test.mjs` exit 0; `bash tools/restore-test.sh` with a tiny dump (created in the test) prints `RESTORE_OK`.
**Done when** — CI job `docs` passes and `docs/runbooks/{breach,restore,ci}.md` exist.

---

### T-PLAT-35 · Shared i18n catalogue structure and key-diff test
- **Closes:** FR-I18N-01, NFR-09, AC-06 (web/API half), GAP-MOB-04 (shared half)
- **Depends on:** T-PLAT-01
- **Milestone:** M0
- **Layer:** platform
**Why** — `packages/shared/src/i18n.ts` is one file; the README promises `i18n/bn.ts`. Web, admin (English only) and API messages need a catalogue with a test that fails on missing keys.
**Files**
- C `packages/shared/src/i18n/{index.ts,bn.ts,en.ts,keys.ts}` ← split `i18n.ts` (keep the exported `t()` and `Locale` API so `apps/web` imports keep working)
- D `packages/shared/src/i18n.ts` (replaced by the folder; `export * from "./i18n/index.js"` in `index.ts`)
- C `packages/shared/src/i18n/i18n.test.ts`
- C `tools/i18n-keys.mjs` — compares `bn.ts` ↔ `en.ts` and (later) `apps/mobile/lib/l10n/app_bn.arb` ↔ `app_en.arb`; prints missing and unused keys
- M root `package.json`: `"i18n:check": "node tools/i18n-keys.mjs"`
**Steps**
1. Keys are dotted lower-camel (`home.spentThisMonth`). `keys.ts` exports the `MessageKey` union generated from `bn.ts`; `en.ts` is typed `Record<MessageKey, string>` so TypeScript already fails on a missing English key.
2. `t(key, params?)` supports `{name}` interpolation and numeral style: `fmtAmount(paisa, { bnDigits })` (existing `money.ts`) used for amounts.
3. Add the API-level messages (plain Bangla error messages for the codes in T-PLAT-06) under `error.*`.
4. `tools/i18n-keys.mjs` also scans `apps/web` and `apps/admin` source for `t("…")` literals and fails on keys not in the catalogue (unused keys are reported as warnings).
**Tests** — `bn and en have identical key sets`, `interpolation replaces params`, `missing key falls back to the key itself in production and throws in tests`, `tools/i18n-keys detects a missing key` (script test).
**Acceptance** — `pnpm --filter @amar-poribar/shared test && pnpm i18n:check` exit 0; `pnpm --filter @amar-poribar/web typecheck` still passes.
**Done when** — adding a key only to `bn.ts` fails `pnpm typecheck`.

---

## Summary table

| Task | Title | Milestone | Parallel group |
|---|---|---|---|
| T-PLAT-01 | Root tooling | M0 | Wave 1 |
| T-PLAT-02 | Module skeleton + gen:module | M0 | Wave 2 |
| T-PLAT-03 | Boundary rules + architecture test | M0 | Wave 2 |
| T-PLAT-04 | Typed config | M0 | Wave 1 |
| T-PLAT-05 | Logger, request ids | M0 | Wave 2 |
| T-PLAT-06 | Error model | M0 | Wave 1 |
| T-PLAT-07 | DB layer + migrations | M0 | Wave 2 |
| T-PLAT-19 | DB test harness | M0 | Wave 3 |
| T-PLAT-08 | Event bus + outbox | M0 | Wave 3 |
| T-PLAT-10 | Rate limiter | M0 | Wave 3 |
| T-PLAT-11 | Feature flags | M0 | Wave 3 |
| T-PLAT-12 | Object storage | M0 | Wave 3 |
| T-PLAT-09 | pg-boss jobs | M0 | Wave 4 |
| T-PLAT-13 | WebSocket hub | M0 | Wave 4 |
| T-PLAT-14 | OpenAPI + drift check | M0 | Wave 4 |
| T-PLAT-15 | Health, ready, metrics | M0 | Wave 5 |
| T-PLAT-16 | Contract vectors | M0 | Wave 5 |
| T-PLAT-17 | Fakes: SMS, FCM | M0 | Wave 3 |
| T-PLAT-18 | Fakes: payments, Claude, TURN | M0 | Wave 4 |
| T-PLAT-20 | Fixtures + seed | M0 | Wave 4 |
| T-PLAT-21 | Tenant-isolation test | M0 | Wave 6 |
| T-PLAT-22 | Staff-safe lint | M0 | Wave 6 |
| T-PLAT-23 … 30 | Move identity, families, ledger, budgeting, recurring, ai, reporting, sync | M0 | Wave 7 (sequential) |
| T-PLAT-31 | Cleanup + baseline freeze + e2e conversion | M0 | Wave 7 end |
| T-PLAT-32 | Compose and Docker targets | M0 | Wave 8 |
| T-PLAT-33 | CI + verify scripts | M0 | Wave 8 |
| T-PLAT-34 | BRD v0.3, runbooks, docs checker | M0 | Wave 8 |
| T-PLAT-35 | i18n catalogue structure | M0 | Wave 1 |

Total: 35 tasks.
