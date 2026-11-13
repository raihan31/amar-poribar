# Backend core tasks

Areas: **T-ID** identity · **T-FAM** families · **T-LED** ledger · **T-BUD** budgeting · **T-REC** recurring · **T-AI** ai · **T-REP** reporting · **T-SYNC** sync.
Rules, template and commands: [README](./README.md). Requirements: [SRS v1.0](../SRS.md) §3, §4.1–4.8, §4.10, §5.2, §6, §7, §9, §12.3, §15.

These tasks assume the **T-PLAT** foundation work (milestone M0) is done. They name the platform capabilities they need rather than T-PLAT task numbers:

| Capability (in `apps/api/src/platform`) | Used as |
|---|---|
| Module skeleton and `registerModule(app, ctx)` | every module has `index.ts`, `http/`, `domain/`, `app/`, `infra/`, `schema.ts`, `events.ts`, `jobs.ts` |
| `ctx.db` | Drizzle client; `ctx.db.transaction(fn)`; each module declares tables with `pgSchema("<module>")` |
| `ctx.events.publish(tx, name, payload)` / `ctx.events.subscribe(name, handlerId, fn)` | transactional outbox + idempotent handlers (SRS §3.5) |
| `ctx.jobs.schedule({ name, cron, tz: "Asia/Dhaka", handler })` and `ctx.jobs.send(name, data)` | pg-boss |
| `ctx.rateLimit.consume(key, { limit, windowSec })` → `{ allowed, retryAfterSec }` | database-backed buckets |
| `ctx.storage.presignPut/presignGet/head/delete` | S3 port; fake = MinIO |
| `ctx.clock.now()`, `ctx.ids.uuid()`, `ctx.ids.uuidv7()` | injectable for tests |
| `ctx.flags.isOn(name)` | feature flags |
| `ctx.ports.<name>` | ports whose implementation another module registers (avoids cycles) |
| Fakes: `FakeSmsGateway`, `FakePushSender`, `FakeClaude` | `tools/fakes` |
| Test kit `tools/fixtures`: `testApp()`, `fx.user({phone?})`, `fx.family({owner, members:[{role}]})`, `fx.signIn(user)` (returns bearer), `fx.txn(family, user, overrides)` | all `*.db.test.ts` files |

`pnpm test:db --filter <pattern>` forwards `<pattern>` to Vitest as a file/test-name filter (for example `--filter identity`). `pnpm db:generate --name <slug>` writes a SQL migration under `apps/api/drizzle/`; every task that changes tables ends by running it and committing the file. `pnpm arch` and `pnpm openapi:check` are in the acceptance list of every task that adds a route or an import.

## Dependency graph and parallelism

```
T-ID-01 ─┬─ T-ID-02 ─ T-ID-03 ─ T-ID-04
         ├─ T-ID-05 ─ T-ID-06
         ├─ T-ID-07
         ├─ T-ID-08 · T-ID-09 · T-ID-10
         └─ T-FAM-01 ─ T-FAM-02 ─┬─ T-FAM-03 · T-FAM-04 ─ T-FAM-05
                                 ├─ T-FAM-06 · T-FAM-08 · T-FAM-09
                                 └─ T-LED-01 ─ T-LED-02 · T-LED-03 ─ T-LED-04 ─ T-LED-05 · T-LED-06 · T-LED-07
                                                                  ├─ T-LED-08 · T-LED-09 · T-LED-10 · T-LED-11
                                                                  ├─ T-BUD-01 ─ T-BUD-02 · T-BUD-03 · T-BUD-04
                                                                  ├─ T-REC-01 ─ T-REC-02 · T-REC-03
                                                                  ├─ T-REP-01 ─ T-REP-02 · T-REP-03 · T-REP-04 · T-REP-05
                                                                  ├─ T-AI-01 ─ T-AI-02..07
                                                                  └─ T-SYNC-01 ─ T-SYNC-02 · T-SYNC-03 · T-SYNC-04
T-FAM-07 needs T-ID-10 and T-FAM-06
```

Parallel lanes once `T-LED-04` is merged: **budgeting** (BUD), **recurring** (REC), **reporting** (REP), **ai** (AI) and **sync** (SYNC) are independent of each other. Identity tasks 02–04, 05–06, 07, 08, 09, 10 are independent lanes after `T-ID-01`.

Breaking-change note: moving routes into modules (T-ID-01, T-FAM-02, T-LED-01, …) keeps every URL and response shape stable unless a task says otherwise. Two intentional changes are listed in the contract of `T-ID-04` (OTP error codes) and `T-LED-04` (`duplicate_trx_id`); each updates `packages/shared/test-vectors/api/*.json` so the mobile contract test sees them.

---

# T-ID · identity (`apps/api/src/modules/identity`)

### T-ID-01 · Identity module skeleton, facade and user table move
- **Closes:** GAP-ARCH-01 (identity part), FR-AUTH-01, FR-AUTH-02, SRS §3.3
- **Depends on:** platform module skeleton, migrations
- **Milestone:** M1 · **Layer:** api
**Why** — Every other module needs users without importing tables. The facade is the only way they will get them.
**Files**
- C `apps/api/src/modules/identity/index.ts` (facade), `schema.ts`, `events.ts`, `jobs.ts`, `http/routes.ts`, `app/get-user.ts`, `infra/user-repo.ts`, `domain/phone.ts`
- M `apps/api/src/db/schema.ts` (remove `users`, re-export nothing), `apps/api/src/app.ts` (register identity first), `apps/api/src/auth.ts` (keep `registerAuth`; move to `modules/identity/http/authenticate.ts`, leave a re-export shim until T-FAM-01 removes `requireRole` from it)
- C migration `apps/api/drizzle/<ts>_identity_schema.sql`
**Steps**
1. Declare `export const identity = pgSchema("identity")` in `schema.ts` and redefine `users` with `identity.table("users", …)`: same columns as `db/schema.ts` today (`id uuid pk default gen_random_uuid()`, `phone text unique not null`, `name text`, `locale text default 'bn'`, `bn_digits boolean default true`, `created_at`, `updated_at`) plus `simple_mode boolean not null default false`, `erasure_requested_at timestamptz`, `erased_at timestamptz`.
2. Migration: `CREATE SCHEMA identity; ALTER TABLE public.users SET SCHEMA identity;` then `ALTER TABLE identity.users ADD COLUMN …`. Existing foreign keys from other tables keep working until T-FAM/T-LED remove them (see the migration notes in those tasks).
3. Facade `index.ts` exports **types** `UserId`, `UserSummary { id; name: string|null; locale; numeralStyle: "bn"|"latin"; simpleMode }`, `UserWithPhone = UserSummary & { phone }` and **functions** `getUser(id): Promise<UserSummary|null>`, `getUsers(ids): Promise<Map<string, UserSummary>>`, `getUserWithPhone(id)`, `findUserByPhone(phone)`, `requireUser(id)` (throws `HttpError(401, "unauthorized")` when missing or `erased_at` set), `maskPhone(phone)` → `•••` + last 3 digits.
4. `domain/phone.ts` re-exports `normalizeBdPhone` and `BdPhoneSchema` from `@amar-poribar/shared` and adds `maskPhone`.
5. `registerModule` registers `authenticate` (existing behaviour) and nothing else yet; routes move in T-ID-04…07.
6. Add `identity` to the module list in `.dependency-cruiser.cjs` allowed-dependency table (depends on `platform` only).
**Contract** — `maskPhone("+8801712345678") === "•••678"`. `getUser` never returns `phone`.
**Tests** `modules/identity/identity.facade.db.test.ts`: `getUser returns null for unknown id`; `requireUser rejects erased users`; `getUsers returns map for many ids`; `maskPhone keeps last three digits`; `facade never exposes phone in UserSummary` (type test with `expectTypeOf`).
**Acceptance** `pnpm typecheck && pnpm test:db --filter identity && pnpm arch && pnpm db:generate --name identity_schema --check`
**Done when** no file outside `modules/identity` imports `users` from a schema file and all existing API tests still pass.

### T-ID-02 · OTP challenge store and rate limits
- **Closes:** FR-AUTH-07, GAP-ID-01, NFR-05
- **Depends on:** T-ID-01
- **Milestone:** M1 · **Layer:** api
**Why** — Today `OtpStore` (`apps/api/src/otp.ts`) keeps codes in memory, so restarts lose them and there are no per-number limits.
**Files** C `modules/identity/domain/otp.ts`, `modules/identity/app/otp-service.ts`, `modules/identity/infra/otp-repo.ts`; M `modules/identity/schema.ts`; D `apps/api/src/otp.ts` and `otp.ts` imports in `app.ts`/`server.ts`; M `apps/api/src/env.ts` (add `OTP_PEPPER`, required in production, ≥ 32 chars).
**Steps**
1. Table `identity.otp_challenges(id uuid pk, phone_hash text not null, code_hash text not null, attempts int not null default 0, ip text, created_at timestamptz default now(), expires_at timestamptz not null, consumed_at timestamptz)`; index `(phone_hash, created_at desc)`. `phone_hash = hex(HMAC_SHA256(OTP_PEPPER, "p:" + phone))`, `code_hash = hex(HMAC_SHA256(OTP_PEPPER, "c:" + phone + ":" + code))`. No plain phone or code is stored.
2. `domain/otp.ts`: `generateCode(): string` using `crypto.randomInt(0, 1_000_000)` zero-padded to 6; constants `OTP_TTL_SEC = 300`, `MAX_ATTEMPTS = 5`, `RESEND_GAP_SEC = 60`, `PER_HOUR = 5`, `PER_DAY = 20`, `PER_IP_HOUR = 30`; `compareCodeHash(a,b)` with `timingSafeEqual`.
3. `OtpService.issue(phone, ip)`: (a) `ctx.rateLimit.consume("otp:hour:"+phoneHash, {limit:5, windowSec:3600})`, `…day:` (20, 86 400), `"otp:ip:"+ip` (30, 3600), `"otp:gap:"+phoneHash` (1, 60); first denied bucket → throw `HttpError(429, "otp_rate_limited", …)` with `details: { retryAfterSeconds }`; (b) invalidate older unconsumed challenges for the phone (`consumed_at = now()`); (c) insert a row; (d) return `{ code, expiresAt }` to the caller (delivery is T-ID-03).
4. `OtpService.verify(phone, code)`: load the newest unconsumed row; none or `expires_at < now` → `HttpError(401, "otp_expired")`; `attempts >= 5` → `HttpError(401, "otp_invalid", { attemptsLeft: 0 })`; otherwise increment `attempts` **before** comparing; mismatch → `HttpError(401, "otp_invalid", { attemptsLeft: 5 - attempts })`; match → set `consumed_at`, return true.
5. A daily job `identity.purge-otp` (cron `10 3 * * *`, Asia/Dhaka) deletes rows with `created_at < now() - interval '24 hours'` (FR-PRIV-06).
**Contract** error body `{ error: { code, message, details? } }` where `details` is `{ attemptsLeft: number }` or `{ retryAfterSeconds: number }`.
**Tests** `modules/identity/otp.db.test.ts`: `issues a 6 digit code and stores only hashes`; `rejects a second request inside 60 seconds with retryAfterSeconds`; `rejects the sixth request in an hour`; `rejects the 21st in a day`; `wrong code decrements attemptsLeft`; `sixth wrong try returns attemptsLeft 0 even with the right code`; `expired code returns otp_expired`; `new code invalidates the old one`; `consumed code cannot be reused`; `purge job deletes rows older than 24h`. Use `ctx.clock` fake to move time.
**Acceptance** `pnpm test:db --filter otp && pnpm typecheck && pnpm arch`
**Done when** no in-memory OTP state remains and limits survive a process restart (test restarts the app between calls).

### T-ID-03 · SmsGateway port, fake, and Bangladeshi adapter
- **Closes:** FR-AUTH-08, GAP-ID-01, SRS §5.5
- **Depends on:** T-ID-02
- **Milestone:** M1 · **Layer:** api
**Why** — OTP must reach real phones in production and be readable by tests.
**Files** C `modules/identity/infra/sms/sms-gateway.ts` (port), `sms-fake.ts`, `sms-sslwireless.ts`, `sms-alpha.ts`, `sms-factory.ts`; C `modules/identity/schema.ts` (table `sms_deliveries`); M `apps/api/src/env.ts`; C `tools/fakes/sms-test-endpoint.ts`.
**Steps**
1. Port: `interface SmsGateway { send(msg: { to: string; text: string; reference: string }): Promise<{ providerId: string }>; }` and `parseDeliveryReceipt(body): { providerId: string; status: "delivered"|"failed"; at: Date }`.
2. `FakeSmsGateway` keeps messages in memory and exposes `lastTo(phone)`, `lastCode(phone)` (regex `\b(\d{6})\b`), `clear()`. In non-production with `SMS_GATEWAY=fake` the API also serves `GET /v1/dev/sms/last?phone=` (registered only when `!isProd`, returns 404 in production).
3. Adapters for SSL Wireless and Alpha SMS are thin: build the provider request with `fetch`, timeout 5 s, one retry on network errors, map provider errors to `HttpError(502, "sms_failed")`. Env: `SMS_GATEWAY=fake|sslwireless|alpha`, `SSLWIRELESS_API_TOKEN`, `SSLWIRELESS_SID`, `ALPHA_SMS_API_KEY`, `SMS_SENDER_ID`. `sms-factory.ts` throws on startup in production when `SMS_GATEWAY=fake` or credentials are missing.
4. Table `identity.sms_deliveries(id uuid pk, phone_hash text, provider text, provider_id text, status text not null default 'sent', sent_at timestamptz default now(), delivered_at timestamptz)`; `POST /v1/webhooks/sms/:provider` (no auth, verified by `SMS_WEBHOOK_SECRET` header) updates `status` — used by system health (FR-ADM-10).
5. OTP message text (Bangla, ≤ 70 chars to stay one SMS segment): `আমার পরিবার কোড: {code}। কাউকে বলবেন না।`
**Tests** `modules/identity/sms.test.ts`: `fake gateway records messages`; `factory refuses fake in production`; `sslwireless adapter maps 401 to sms_failed` (uses `msw`); `receipt webhook rejects a bad secret`; `OTP text is at most 70 characters`.
**Acceptance** `pnpm test:db --filter sms && pnpm arch && pnpm openapi:check`
**Done when** switching `SMS_GATEWAY` changes the adapter without code edits and the fake is unavailable in production.

### T-ID-04 · OTP request and verify routes in the identity module
- **Closes:** FR-AUTH-01, FR-AUTH-07, AC-12 (API half)
- **Depends on:** T-ID-02, T-ID-03, T-ID-05 (token issuing)
- **Milestone:** M1 · **Layer:** api
**Why** — Route handlers in `routes/auth.ts` still call the old store and return `devCode`.
**Files** C `modules/identity/http/auth-routes.ts`, `app/request-otp.ts`, `app/verify-otp.ts`; D `apps/api/src/routes/auth.ts` (the `/v1/me` handler moves in T-FAM-03); M `packages/shared/src/schemas.ts` (add `OtpRequestSchema`, `OtpVerifySchema`); M `packages/shared/test-vectors/api/errors.json`.
**Steps**
1. `POST /v1/auth/otp/request {phone}` → `OtpService.issue` → `SmsGateway.send`; response `{ sent: true, resendInSeconds: 60 }`. When `!isProd && SMS_GATEWAY==="fake"` also `devCode` (kept so the existing mobile dev flow works).
2. `POST /v1/auth/otp/verify {phone, code}` → `OtpService.verify`; upsert the user (`INSERT … ON CONFLICT (phone) DO UPDATE SET updated_at = now()` — same as today); then `SessionService.start(userId, deviceId?)` (T-ID-05) and return `{ accessToken, refreshToken, user: UserSummary, isNewUser: boolean }`. A user with `erased_at` set gets `401 account_erased`; a user with `erasure_requested_at` signs in and the response includes `erasurePending: true` (FR-PRIV-04 cancel path).
3. Rename error `invalid_otp` → `otp_invalid` (keep HTTP 401). Update `api_client_test.dart` fixture list through `packages/shared/test-vectors/api/errors.json` (cases: `otp_invalid`, `otp_expired`, `otp_rate_limited`).
4. Add Zod response schemas for OpenAPI.
**Tests** `modules/identity/auth-routes.db.test.ts`: `request sends one SMS to the fake gateway`; `verify creates a user and returns tokens`; `verify with wrong code returns otp_invalid and attemptsLeft`; `sixth code request in an hour returns otp_rate_limited`; `isNewUser true only on first sign in`; `erased user gets account_erased`; `devCode absent when production flag is set`.
**Acceptance** `pnpm test:db --filter auth-routes && pnpm openapi:check && pnpm arch`
**Done when** AC-12 API assertions pass.

### T-ID-05 · Sessions and refresh-token rotation
- **Closes:** FR-AUTH-03, GAP-ID-02, AC-13 (API half)
- **Depends on:** T-ID-01
- **Milestone:** M1 · **Layer:** api
**Why** — Refresh tokens are plain 30-day JWTs today (`routes/auth.ts` `issueTokens`); they cannot be revoked or rotated.
**Files** C `modules/identity/domain/session.ts`, `app/session-service.ts`, `infra/session-repo.ts`; M `schema.ts`; M `modules/identity/http/authenticate.ts`.
**Steps**
1. Table `identity.sessions(id uuid pk, user_id uuid not null, chain_id uuid not null, device_id text, refresh_hash text not null unique, parent_id uuid, created_at, last_used_at, expires_at timestamptz not null, rotated_at timestamptz, revoked_at timestamptz, revoked_reason text)`; indexes `(user_id)`, `(chain_id)`.
2. Refresh token format: `base64url(sessionId) + "." + base64url(32 random bytes)`; store `refresh_hash = sha256(secret)`. Lifetime 30 days (`expires_at`).
3. `start(userId, deviceId)` inserts a session with a new `chain_id` and returns `{ accessToken, refreshToken }`. Access JWT: `{ sub, sid, typ: "access" }`, 15 minutes, signed by `@fastify/jwt`.
4. `rotate(refreshToken)`: parse id; load row; if `revoked_at` or `expires_at < now` → `401 refresh_invalid`. If `rotated_at` is set: when `now - rotated_at ≤ 10 s` → `409 refresh_in_flight` (client retries with the new token, no revocation); otherwise revoke **every** session with the same `chain_id` (`revoked_reason = 'reuse'`) and return `401 refresh_reused`. Otherwise in one transaction set `rotated_at = now`, insert the child row (`parent_id`, same `chain_id`, fresh secret), return new tokens.
5. `authenticate` also calls `isSessionRevoked(sid)` backed by a 30-second in-process cache (`Map<sid, {revoked, until}>`) filled from the table; revoked → `401 unauthorized`.
6. Job `identity.purge-sessions` (cron `20 3 * * *`): delete rows with `expires_at < now() - interval '7 days'`.
**Contract** `POST /v1/auth/refresh {refreshToken, deviceId?}` → `{ accessToken, refreshToken }`; errors `refresh_invalid`, `refresh_reused`, `refresh_in_flight`.
**Tests** `modules/identity/session.db.test.ts`: `refresh returns a new pair and marks the old one rotated`; `reuse after 10 seconds revokes the whole chain`; `reuse within 10 seconds returns refresh_in_flight`; `expired refresh is rejected`; `revoked session fails authenticate within 30 seconds`; `access token carries sid`; `old stateless refresh JWTs are rejected` (migration safety: they are not valid base64url ids).
**Acceptance** `pnpm test:db --filter session && pnpm openapi:check && pnpm arch`
**Done when** a stolen refresh token used after the legitimate client has rotated it kills the session chain.

### T-ID-06 · Logout and logout-everywhere
- **Closes:** FR-AUTH-03, FR-AUTH-09
- **Depends on:** T-ID-05
- **Milestone:** M1 · **Layer:** api
**Why** — The app must be able to end a session and unregister its push token.
**Files** C `modules/identity/http/logout-routes.ts`, `app/logout.ts`.
**Steps** 1. `POST /v1/auth/logout {refreshToken?}` revokes the session identified by the access token's `sid` (reason `logout`) and deletes the device row for the `deviceId` if given (calls T-ID-09 `removeDevice`). 2. `POST /v1/auth/logout-all` revokes every session of the user (`revoked_reason = 'logout_all'`). 3. Both return `204`.
**Contract** `204 No Content`; `401` when unauthenticated.
**Tests** `logout revokes the current session only`; `logout-all revokes all sessions`; `revoked access token is refused within 30 seconds`; `logout removes the device token`.
**Acceptance** `pnpm test:db --filter logout && pnpm openapi:check`
**Done when** AC-13 API assertions pass.

### T-ID-07 · Profile and preferences (`PATCH /v1/me`)
- **Closes:** FR-AUTH-04, GAP-ID-03
- **Depends on:** T-ID-01
- **Milestone:** M1 · **Layer:** api
**Why** — Users cannot change name, language, numerals or Simple mode through the API.
**Files** C `modules/identity/http/me-routes.ts`, `app/update-profile.ts`; M `packages/shared/src/schemas.ts` (`UpdateProfileSchema`, `UserProfileSchema`).
**Steps**
1. `UpdateProfileSchema = z.object({ name: z.string().trim().min(1).max(60).nullable(), locale: z.enum(["bn","en"]), numeralStyle: z.enum(["bn","latin"]), simpleMode: z.boolean() }).partial().refine(nonEmpty)`.
2. `PATCH /v1/me` maps `numeralStyle` to the `bn_digits` column (`bn` → true), updates `updated_at`, returns `UserProfile { id, phone, name, locale, numeralStyle, simpleMode, createdAt }`.
3. **Module boundary decision:** `GET /v1/me` includes the user's families, which live in `families`, and `families` depends on `identity`. To keep the graph acyclic, `GET /v1/me` is registered by the **families** module (T-FAM-03) and composes `identity.getUserWithPhone` + `families.listMemberships`. `PATCH /v1/me`, consents, devices and export/erasure routes stay in identity/privacy.
4. Reminder time and quiet hours are not stored here; they live in `notifications.preferences` (FR-NOTIF-05) and the client edits them through `/v1/me/notification-preferences`.
**Contract** request/response above; `400 invalid_request` on bad enum.
**Tests** `patch name trims whitespace`; `patch numeralStyle latin stores bn_digits false`; `empty body is rejected`; `simpleMode round trips`; `another user's profile is untouched`.
**Acceptance** `pnpm test:db --filter me-routes && pnpm openapi:check`
**Done when** the mobile Profile screen (F8) can read and write every field it shows that belongs to identity.

### T-ID-08 · Consent records
- **Closes:** FR-AUTH-10, FR-PRIV-01, FR-PRIV-02 (serving), GAP-ID-04
- **Depends on:** T-ID-01
- **Milestone:** M1 · **Layer:** api
**Why** — PDPO needs explicit, versioned consent, and the app must show the current policy in Bangla and English.
**Files** C `modules/identity/http/consent-routes.ts`, `app/consents.ts`, `domain/policy.ts`, `content/policy.bn.md`, `content/policy.en.md`, `content/policy.version.ts` (`export const POLICY_VERSION = "2026-11-01"`); M `schema.ts`.
**Steps**
1. Table `identity.consents(id uuid pk, user_id uuid not null, kind text not null check (kind in ('privacy_policy','voice_notes')), version text not null, locale text not null, accepted_at timestamptz default now(), unique (user_id, kind, version))`.
2. `GET /v1/policy?locale=bn|en` (public) → `{ version, locale, markdown, updatedAt }`. The route is registered by identity with OpenAPI tag `privacy`; `privacy` will reuse `identity.getPolicyVersion()` (decision: avoids a privacy→identity content copy).
3. `POST /v1/me/consents {kind, version, locale}` → 201 and idempotent per `(user, kind, version)`; rejects an unknown version with `409 policy_version_outdated` (`details.currentVersion`).
4. `GET /v1/me/consents` → `{ privacyPolicy: { acceptedVersion, current: POLICY_VERSION, needsAcceptance }, voiceNotes: { accepted } }`.
5. Facade: `hasAcceptedCurrentPolicy(userId)`, used by the clients through `GET /v1/me/consents`; the API does not block other routes (the app gates the UI, FR-AUTH-10).
6. Policy text must contain the cross-border AI disclosure and the voice-note retention line (180 days); a test greps for both Bangla and English phrases.
**Tests** `accepting the same version twice returns one row`; `outdated version is rejected`; `needsAcceptance true after POLICY_VERSION changes`; `policy endpoint serves bn and en`; `policy mentions cross border AI and 180 days`.
**Acceptance** `pnpm test:db --filter consent && pnpm openapi:check`
**Done when** screen A2 can render the policy and record acceptance.

### T-ID-09 · Device registry (push tokens)
- **Closes:** FR-AUTH-11, FR-NOT-01 (prerequisite), FR-NOTIF-07
- **Depends on:** T-ID-01
- **Milestone:** M1 · **Layer:** api
**Why** — Push needs to know which tokens belong to whom, and bad tokens must be cleaned.
**Files** C `modules/identity/http/device-routes.ts`, `app/devices.ts`, `infra/device-repo.ts`; M `schema.ts`, `index.ts`.
**Steps**
1. Table `identity.devices(user_id uuid, device_id text, platform text check (platform in ('android','ios','web')), fcm_token text, app_version text, locale text, last_seen_at timestamptz default now(), created_at default now(), primary key (user_id, device_id))`; unique partial index on `fcm_token` where not null.
2. `PUT /v1/me/devices/:deviceId {platform, fcmToken?, appVersion, locale}` upserts and clears the same token on any other row (a phone sold to someone else); `DELETE /v1/me/devices/:deviceId` → 204.
3. Facade: `listDeviceTokens(userIds): Promise<{ userId; deviceId; platform; token }[]>`, `removeToken(token)`, `touchDevice(userId, deviceId)` (updates `last_seen_at`, used by the WebSocket hub).
4. Job `identity.purge-devices` (cron `30 3 * * *`): delete devices not seen for 120 days.
**Tests** `register stores token and platform`; `same token on a second user moves ownership`; `delete removes the row`; `listDeviceTokens skips rows without tokens`; `purge removes stale devices`; `route requires auth`.
**Acceptance** `pnpm test:db --filter device && pnpm openapi:check && pnpm arch`
**Done when** the notifications module can fetch tokens only through the facade.

### T-ID-10 · Erasure hook and `UserErased` event
- **Closes:** FR-PRIV-04 (identity side), AC-28, SRS §3.5
- **Depends on:** T-ID-05, T-ID-09
- **Milestone:** M5 · **Layer:** api
**Why** — Erasure touches every module. Identity owns the user row and announces the erasure; each module reacts.
**Files** M `modules/identity/index.ts`, `events.ts`; C `modules/identity/app/erase-user.ts`, `app/erasure-state.ts`.
**Steps**
1. Facade functions for the privacy module: `markErasureRequested(userId, at)`, `cancelErasure(userId)`, `eraseUser(userId)`.
2. `eraseUser`: in one transaction (a) revoke all sessions, (b) delete devices and consents, (c) set `phone = 'erased:' || id`, `name = NULL`, `erased_at = now()`, (d) publish `identity.UserErased.v1 { userId, erasedAt }` through the outbox.
3. Event type in `events.ts`: `export type UserErasedV1 = { userId: string; erasedAt: string }`.
4. The user row is kept (other modules reference `userId` in anonymised rows).
**Tests** `eraseUser anonymises phone and name`; `eraseUser revokes sessions and deletes devices`; `eraseUser publishes UserErased once`; `eraseUser is idempotent`; `cancelErasure clears the flag`; `sign in after erasure returns account_erased`.
**Acceptance** `pnpm test:db --filter erase && pnpm arch`
**Done when** a handler registered in another module receives the event in tests.

---

# T-FAM · families (`apps/api/src/modules/families`)

### T-FAM-01 · Families facade and role rules
- **Closes:** FR-FAM-03, SRS §3.4 R1/R3
- **Depends on:** T-ID-01
- **Milestone:** M1 · **Layer:** api
**Why** — `requireRole` (`apps/api/src/auth.ts`) takes a raw `db` and reads `family_members`. Every route in every module calls it, so it must live behind the families facade.
**Files** C `modules/families/index.ts`, `schema.ts`, `events.ts`, `domain/roles.ts`, `app/require-role.ts`, `infra/member-repo.ts`; M `apps/api/src/auth.ts` (delete `requireRole`, `canEditAll`, `canAssignRole`, `canManageMember`); M every route file importing them (`routes/transactions.ts`, `budgets.ts`, `festivals.ts`, `recurring.ts`, `reports.ts`, `ai.ts`, `sync.ts`, `families.ts`, `invites.ts`).
**Steps**
1. `domain/roles.ts` holds `ROLE_RANK`, `canEditAll`, `canAssignRole`, `canManageMember` verbatim from today's `auth.ts`.
2. Facade: `requireRole(familyId, userId, minRole, opts?: { write?: boolean }): Promise<{ role: Role; family: FamilySummary }>`. Non-members → `HttpError(404, "not_found", "Family not found")` (never 403, per SRS acceptance 7); insufficient role → 403 `forbidden`; `opts.write === true` and family `status = 'suspended'` → `423 family_suspended` (T-FAM-08 adds the column; until then the check is a no-op).
3. Also export `listMemberships(userId)`, `listMemberIds(familyId)`, `isMember(familyId, userId)`, `canEditAll(role)`.
4. Update each route to `await families.requireRole(...)`. During this task keep passing `db` where routes still query their own tables.
5. Add an ESLint rule exception list so only `modules/families` imports `family_members`.
**Tests** `modules/families/roles.test.ts` (pure): `owner outranks admin`; `only owner can assign admin`; `nobody can assign owner`; `admin cannot manage another admin`. `modules/families/require-role.db.test.ts`: `non member gets 404`; `viewer fails a member route with 403`; `member passes member route`; `write flag on active family passes`.
**Acceptance** `pnpm test:db --filter families && pnpm typecheck && pnpm arch`
**Done when** `grep -R "familyMembers" apps/api/src --include=*.ts -l` lists only files inside `modules/families`.

### T-FAM-02 · Move family tables, create-family use case, `FamilyCreated` event
- **Closes:** FR-FAM-01, SRS §3.5, GAP-ARCH-01
- **Depends on:** T-FAM-01
- **Milestone:** M1 · **Layer:** api
**Why** — `routes/families.ts` inserts categories and accounts directly inside `POST /v1/families`; that belongs to the ledger, reached by an event.
**Files** M `modules/families/schema.ts` (tables `families`, `family_members`, `family_invites` in `pgSchema("families")`); C `app/create-family.ts`, `http/family-routes.ts`; M `events.ts`; D create handler from `routes/families.ts`; C migration.
**Steps**
1. Migration: `CREATE SCHEMA families; ALTER TABLE public.families SET SCHEMA families; … family_members …; … family_invites …;` Add columns: `families.families.status text not null default 'active' check (status in ('active','suspended'))`, `suspended_at timestamptz`, `suspended_reason text`, `member_limit int not null default 3`, `ai_quota_month` stays (billing reads it via T-AI-03). Drop cross-schema FKs: `family_members.user_id → users.id`, `families.created_by → users.id`, `family_invites.created_by/accepted_by → users.id` (`ALTER TABLE … DROP CONSTRAINT`); keep intra-schema FKs.
2. `createFamily(userId, name)`: in one transaction insert the family, insert the owner membership, publish `families.FamilyCreated.v1 { familyId, ownerUserId, name, createdAt }`.
3. The default categories and accounts are created by the **ledger** handler (T-LED-02). Until it lands, keep the existing inserts behind `if (!ctx.flags.isOn("ledger_seed_via_event"))`.
4. `POST /v1/families` response unchanged (`201` with the family row; add `memberLimit`, `status`).
**Contract** event `FamilyCreatedV1 = { familyId: string; ownerUserId: string; name: string; createdAt: string }`.
**Tests** `create family makes the caller owner`; `create family publishes FamilyCreated once`; `status defaults to active and memberLimit to 3`; `family name is trimmed and limited to 80`.
**Acceptance** `pnpm test:db --filter create-family && pnpm arch && pnpm db:generate --name families_schema --check`
**Done when** `routes/families.ts` contains no family-creation SQL.

### T-FAM-03 · `GET /v1/me`, `GET/PATCH /v1/families/:id`, members DTO
- **Closes:** FR-FAM-01, FR-FAM-04 (data), FR-PRES-01 (DTO), GAP-FAM-01
- **Depends on:** T-FAM-02, T-ID-07
- **Milestone:** M1 · **Layer:** api
**Why** — The family switcher (F2) needs role, status and member counts; chat and presence need a stable member DTO.
**Files** C `http/me-routes.ts`, `app/get-me.ts`, `app/update-family.ts`, `app/list-members.ts`; D members/me handlers from `routes/invites.ts`, `routes/auth.ts`.
**Steps**
1. `GET /v1/me` → `{ user: UserProfile, families: [{ id, name, role, status, memberLimit, memberCount }], consents: { policyVersion, needsAcceptance } }` (composes `identity.getUserWithPhone`, `identity.hasAcceptedCurrentPolicy`, `families.listMemberships`).
2. `GET /v1/families/:id` (any role) → family row + `memberCount`, `myRole`. `PATCH /v1/families/:id {name}` (owner or admin) renames; other fields are not editable here.
3. `GET /v1/families/:id/members` → `[{ userId, name, displayName, role, joinedAt, isYou }]` where `displayName = name ?? maskPhone(phone)`. Phone numbers are returned only to **owner and admin** callers (field `phone`); members and viewers receive `null` (privacy inside families). This is a deliberate tightening of today's behaviour (every member sees phones); the web app's Members screen already hides it for non-admins in the design (B4).
4. Remove the old route from `invites.ts`.
**Tests** `me returns families with role and memberCount`; `patch family renames for admin and rejects member`; `members list hides phone from members`; `members list shows phone to admins`; `me includes needsAcceptance true for a new user`.
**Acceptance** `pnpm test:db --filter me-routes && pnpm test:db --filter members && pnpm openapi:check`
**Done when** the Family tab (B4) and the family switcher (F2) data are both served by these routes.

### T-FAM-04 · Invite preview, accept states, list and revoke
- **Closes:** FR-FAM-02, FR-ONB-03, AC-06 (A6/F6 states)
- **Depends on:** T-FAM-02
- **Milestone:** M1 · **Layer:** api
**Why** — Screen A6 shows who invited you and what you get; F6 needs distinct "expired" and "used" states. Today's accept route (`routes/invites.ts`) only returns 404.
**Files** C `http/invite-routes.ts`, `app/invites.ts`, `domain/invite.ts`; M `schema.ts` (add `revoked_at timestamptz` to `family_invites`); D `routes/invites.ts`.
**Steps**
1. `GET /v1/invites/:token` (no auth required, rate limited 30/min per IP) → `{ familyName, memberCount, invitedBy: { name }, role, expiresAt, state: "valid"|"expired"|"used"|"revoked", forPhoneMasked? }`. Unknown token → `404 invite_not_found`. Never returns phone numbers or member names other than the inviter's display name.
2. `POST /v1/invites/:token/accept` (auth): maps states to errors: `410 invite_expired`, `409 invite_used`, `410 invite_revoked`, `403 invite_wrong_phone`, `402`-free; checks the family member limit (`409 member_limit` with `details.limit`); idempotent when the caller is already a member (returns `{ familyId, role, alreadyMember: true }`). On success inserts the membership and publishes `families.MemberJoined.v1 { familyId, userId, role, invitedBy }`.
3. `GET /v1/families/:id/invites` (admin) lists pending invites (no token for invites created by someone else; the creator sees the token); `DELETE /v1/families/:id/invites/:inviteId` (admin) sets `revoked_at`.
4. Keep `POST /v1/families/:id/invites` here (moved); response adds `link: ${PUBLIC_WEB_URL}/join/${token}` built from env `PUBLIC_WEB_URL`.
5. Job `families.purge-invites` (cron `40 3 * * *`): delete invites expired or revoked more than 30 days ago (FR-PRIV-06).
**Tests** `preview shows valid invite details`; `preview returns expired after 7 days`; `preview returns used after accept`; `accept adds member and publishes MemberJoined`; `accept twice by same user is idempotent`; `accept by another user returns invite_used`; `wrong phone returns invite_wrong_phone`; `member limit blocks accept`; `revoked invite cannot be accepted`; `invite role escalation is rejected` (existing rule: only owner invites admins).
**Acceptance** `pnpm test:db --filter invite && pnpm openapi:check`
**Done when** every state in design screens A6 and F6 maps to one error code.

### T-FAM-05 · Invite delivery through events
- **Closes:** FR-FAM-06, GAP-FAM-02
- **Depends on:** T-FAM-04, T-NOTIF inbox facade (capability `notifications.notify(userId, item)`) — if absent, publish only
- **Milestone:** M1 · **Layer:** api
**Why** — An invite addressed to a phone number must reach that person.
**Files** M `app/invites.ts`, `events.ts`; C `app/on-invite-created.ts`.
**Steps**
1. When an invite has `phone`, publish `families.InviteCreated.v1 { inviteId, familyId, token, phone, role, inviterUserId, expiresAt }`.
2. Handler in `families` (idempotent by `inviteId`): look up `identity.findUserByPhone(phone)`. If found → call the notifications port `ctx.ports.notify({ userId, kind: "invite", title, body, data: { token } })` (Bangla body: `{inviter} আপনাকে {family} পরিবারে ডাকছেন`). If not found → send SMS through `ctx.ports.smsSend(phone, text)` with the link `${PUBLIC_WEB_URL}/join/${token}` (text ≤ 70 chars plus link; two segments allowed).
3. Both ports are declared in `families/app/ports.ts` and implemented by identity (`smsSend`) and notifications (`notify`) at registration, so `families` imports neither.
**Contract** event payload above; ports: `notify(args): Promise<void>`, `smsSend(phone, text): Promise<void>`.
**Tests** `invite for an existing user creates an inbox item`; `invite for an unknown phone sends one SMS with the link`; `handler is idempotent on retry`; `invite without phone sends nothing`.
**Acceptance** `pnpm test:db --filter invite-delivery && pnpm arch`
**Done when** the fake gateway and fake notify port see exactly one delivery per invite.

### T-FAM-06 · Ownership transfer
- **Closes:** FR-FAM-07, FR-AUTH-05 (prerequisite)
- **Depends on:** T-FAM-03
- **Milestone:** M1 · **Layer:** api
**Why** — An owner cannot delete their account (F7) before handing the family to someone.
**Files** C `http/transfer-routes.ts`, `app/transfer-ownership.ts`.
**Steps** 1. `POST /v1/families/:id/transfer-ownership {toUserId}` (owner only). Target must be an `admin` (else `409 target_not_admin`). 2. In one transaction set the target to `owner` and the caller to `admin`; publish `families.OwnershipTransferred.v1 { familyId, fromUserId, toUserId, by: "owner"|"staff" }`. 3. Facade `transferOwnership(familyId, toUserId, actor: { kind: "user"|"staff", id })` for the admin module (staff may transfer to any member; sets `by: "staff"`).
**Contract** `200 { familyId, owner: toUserId }`; errors `403 forbidden`, `409 target_not_admin`, `404`.
**Tests** `owner transfers to admin`; `transfer to member is rejected`; `non owner cannot transfer`; `exactly one owner after transfer`; `event published once`.
**Acceptance** `pnpm test:db --filter transfer && pnpm openapi:check`
**Done when** a family always has exactly one owner after every operation tested.

### T-FAM-07 · Orphaned-family handling on user erasure
- **Closes:** FR-FAM-08, AC-28 (families part)
- **Depends on:** T-ID-10, T-FAM-06
- **Milestone:** M5 · **Layer:** api
**Why** — If the owner is erased, the family must not be left without one.
**Files** C `app/on-user-erased.ts`, `jobs.ts`.
**Steps** 1. Subscribe to `identity.UserErased.v1`. For each membership of the user: remove it; if the user was owner, promote the oldest admin by `joined_at`, else the oldest member, else (no members left) set `scheduled_deletion_at = now() + 30 days` (new nullable column on `families.families`) and publish `families.FamilyScheduledForDeletion.v1`. Publish `families.MemberRemoved.v1` for each removal. 2. Job `families.delete-scheduled` (cron `50 3 * * *`) publishes `families.FamilyDeleted.v1 { familyId }` for rows past the date and deletes the family row; other modules delete their data on this event (ledger and comms add handlers in their tasks). 3. Viewers never become owner.
**Tests** `owner erased promotes oldest admin`; `no admin promotes oldest member`; `viewer is never promoted`; `last member erased schedules deletion`; `deletion job fires FamilyDeleted after 30 days` (fake clock); `handler is idempotent`.
**Acceptance** `pnpm test:db --filter orphan && pnpm arch`
**Done when** AC-28 families assertions pass.

### T-FAM-08 · Suspension flag and `423 family_suspended`
- **Closes:** FR-FAM-09, FR-ADM-06 (module part)
- **Depends on:** T-FAM-01
- **Milestone:** M5 · **Layer:** api
**Why** — Staff must be able to freeze a family without deleting it.
**Files** C `app/suspension.ts`; M `app/require-role.ts`, `index.ts`, `events.ts`.
**Steps** 1. Facade `suspendFamily(familyId, reason, actor)` and `unsuspendFamily(familyId, actor)` set `status`, `suspended_at`, `suspended_reason` and publish `families.FamilySuspended.v1 { familyId, reason }` / `FamilyUnsuspended.v1`. Both are marked `@staff-safe`. 2. `requireRole(..., { write: true })` returns `423 family_suspended` (body `{ code, message: "এই পরিবারের হিসাব এখন শুধু দেখা যাবে" }` in Bangla with `message_en`). 3. Every mutating route in ledger, budgeting, recurring, shopping, lending and comms passes `{ write: true }`; add a lint test that scans route files for `POST|PUT|PATCH|DELETE` handlers lacking the flag (allowlist for auth and privacy routes).
**Tests** `suspended family rejects transaction create with 423`; `suspended family still allows reads`; `unsuspend restores writes`; `lint test finds a mutating route without write flag` (fixture file).
**Acceptance** `pnpm test:db --filter suspension && pnpm arch`
**Done when** no mutating family-scoped route is reachable while suspended.

### T-FAM-09 · Member limit from plan, and staff-safe aggregates
- **Closes:** FR-FAM-10, FR-ADM-02/03/04 (data), DEC-18
- **Depends on:** T-FAM-04
- **Milestone:** M5 · **Layer:** api
**Why** — Billing depends on families, so families cannot call billing; it keeps a local limit that billing updates through an event. Admin needs aggregates without reaching into tables.
**Files** C `app/on-subscription-changed.ts`, `app/aggregates.ts`; M `index.ts`.
**Steps** 1. Subscribe to `billing.SubscriptionChanged.v1 { familyId, planKey, memberLimit, aiQuotaMonth, historyMonths }` (subscriber is a no-op until billing exists): update `families.families.member_limit`, `ai_quota_month`. Default stays 3 / 100 (the Free plan). 2. The invite-accept and invite-create routes enforce `member_limit` (`409 plan_member_limit`, `details.limit`); removing members never blocks. 3. Facade (all tagged `/** @staff-safe */`): `listFamilySummaries({ query, status, plan, cursor, limit })` → rows `{ familyId, name, memberCount, ownerPhoneMasked|null, plan, status, createdAt, lastActiveAt|null, noOwner }`; `getFamilyAggregate(familyId)` → `{ familyId, name, status, members: [{ userId, displayName, role, phoneMasked }], createdAt }`; `countFamilies()`; `listFamiliesWithoutOwner()`. `lastActiveAt` comes from `ledger.getLastActivity(familyId)` through a port (added in T-LED-03, `null` until then). 4. A type-level test asserts the return types contain no key from `private-fields.ts`.
**Tests** `invite beyond limit returns plan_member_limit`; `subscription event updates the limit`; `aggregates mask phones`; `aggregates contain no private fields` (type test); `family without owner is listed`.
**Acceptance** `pnpm test:db --filter families-aggregates && pnpm arch`
**Done when** the admin module can build C2/C3 data using only these functions.

---

# T-LED · ledger (`apps/api/src/modules/ledger`)

Today the ledger is spread over `routes/transactions.ts`, the account and category handlers inside `routes/families.ts`, `totals.ts`, `csv.ts` (reporting) and the visibility filter `or(eq(transactions.isPrivate,false), eq(transactions.createdBy,userId))`, which is copied in five files (GAP-REP-02).

### T-LED-01 · Ledger module skeleton and table move
- **Closes:** GAP-ARCH-01 (ledger), SRS §6.1
- **Depends on:** T-FAM-02
- **Milestone:** M2 · **Layer:** api
**Why** — Accounts, categories and transactions must live in schema `ledger` and stop being imported by other modules.
**Files** C `modules/ledger/{index.ts,schema.ts,events.ts,jobs.ts}`, `http/`, `domain/`, `app/`, `infra/`; M `apps/api/src/db/schema.ts` (remove `accounts`, `categories`, `transactions`, `txnSyncSeq`, `bumpSyncSeq`); C migration.
**Steps**
1. `schema.ts`: `pgSchema("ledger")` with `accounts`, `categories`, `transactions` copied from `db/schema.ts` (same columns and indexes) and the sequence `ledger.txn_sync_seq`. `bumpSyncSeq = sql\`nextval('ledger.txn_sync_seq')\`` exported only inside the module.
2. Migration: `CREATE SCHEMA ledger; ALTER TABLE public.accounts SET SCHEMA ledger; … categories … transactions …; ALTER SEQUENCE public.txn_sync_seq SET SCHEMA ledger; ALTER TABLE ledger.transactions ALTER COLUMN sync_seq SET DEFAULT nextval('ledger.txn_sync_seq');` Then drop cross-schema foreign keys: `accounts.family_id`, `accounts.owner_user_id`, `categories.family_id`, `transactions.family_id`, `paid_by_user_id`, `created_by`. Keep `transactions.category_id → categories.id` and `account_id → accounts.id` (same schema).
3. Rename index `txn_family_time_idx` to cover `(family_id, occurred_at desc, id desc)` (needed by T-LED-05): `DROP INDEX …; CREATE INDEX txn_family_time_idx ON ledger.transactions (family_id, occurred_at DESC, id DESC) WHERE deleted_at IS NULL;`
4. Facade `index.ts` exports types only for now (`TransactionDto`, `AccountDto`, `CategoryDto`); functions are added by later tasks.
5. Leave the existing route files in place but import tables from `modules/ledger/schema.ts` through a temporary internal barrel; T-LED-04…T-LED-08 move each route and delete the barrel.
**Tests** `modules/ledger/schema.db.test.ts`: `tables exist in schema ledger`; `sequence default produces increasing sync_seq`; `no foreign key crosses schemas` (queries `information_schema.table_constraints`).
**Acceptance** `pnpm test:db && pnpm arch && pnpm db:generate --name ledger_schema --check`
**Done when** all existing tests pass against the moved tables.

### T-LED-02 · Seed defaults on `FamilyCreated`; category icon ids
- **Closes:** FR-CAT-01, FR-CAT-02, FR-FAM-01
- **Depends on:** T-LED-01, T-FAM-02
- **Milestone:** M2 · **Layer:** api + shared
**Why** — The family module no longer seeds ledger data. The design (A4, E2) uses a fixed set of 20 line icons, but `DEFAULT_CATEGORIES` in `packages/shared/src/categories.ts` still stores emoji.
**Files** C `packages/shared/src/icons.ts`; M `packages/shared/src/categories.ts`, `packages/shared/src/schemas.ts` (`CreateCategorySchema.icon`, `UpdateCategorySchema.icon`); C `modules/ledger/app/on-family-created.ts`, `http/category-routes.ts`, `http/account-routes.ts`; M migration; C `packages/shared/src/icons.test.ts`.
**Steps**
1. `icons.ts`: `export const CATEGORY_ICON_IDS = ["bag","home","bolt","flame","drop","wifi","phone","ride","school","pulse","helper","shirt","plate","hands","heart","gift","basket","comb","film","bank","receipt","box","wallet","shop","plane","key","dots"] as const` (the icons drawn in boards A4 and E2) and `EMOJI_TO_ICON` mapping the 27 emoji used today to ids (🛒→bag, 🏠→home, 💡→bolt, 🔥→flame, 🚰→drop, 📶→wifi, 📱→phone, 🛺→ride, 📚→school, 💊→pulse, 🧹→helper, 👕→shirt, 🍛→plate, 🤝→hands, 🕌→heart, 🎉→gift, 🎁→gift, 🧺→basket, 🧴→comb, 🎬→film, 🏦→bank, 🧾→receipt, 📦→box, 💼→wallet, 🏪→shop, ✈️→plane, 🏘️→key, 💰→wallet).
2. `DEFAULT_CATEGORIES[].icon` becomes an icon id. Add a unit test that every default icon is in `CATEGORY_ICON_IDS` and that `EMOJI_TO_ICON` covers every emoji previously used.
3. `CreateCategorySchema.icon = z.enum(CATEGORY_ICON_IDS).optional()`; `UpdateCategorySchema.icon = z.enum(CATEGORY_ICON_IDS).nullable()`. Existing rows: migration `UPDATE ledger.categories SET icon = CASE icon WHEN '🛒' THEN 'bag' … ELSE 'dots' END WHERE icon IS NOT NULL` (generated from `EMOJI_TO_ICON` by a script `scripts/gen-icon-migration.ts` so the SQL and the TypeScript never drift).
4. `on-family-created.ts`: subscribes to `families.FamilyCreated.v1` (handler id `ledger.seed-family`), inserts `DEFAULT_CATEGORIES` and two accounts (`Cash / নগদ` type `cash` shared; `bKash` type `bkash` with `owner_user_id = ownerUserId`) inside one transaction, idempotent via `ON CONFLICT (family_id, key) DO NOTHING` (add unique index `categories(family_id, key)`) and a check that the family has no accounts.
5. Move category and account CRUD from `routes/families.ts` into `http/category-routes.ts` and `http/account-routes.ts` unchanged except: category `POST` validates the icon enum; account owner validation uses `families.isMember`.
6. Remove the seeding code from `app/create-family.ts` and the `ledger_seed_via_event` flag (T-FAM-02).
**Contract** `GET /v1/families/:id/categories` returns `icon` as an id; clients map id → drawing.
**Tests** `modules/ledger/seed.db.test.ts`: `creating a family seeds 27 categories and 2 accounts`; `seeding twice changes nothing`; `bKash account belongs to the owner`. `icons.test.ts`: `every default icon is a known id`; `emoji map covers old values`. `category-routes.db.test.ts`: `custom category with unknown icon returns 400`; `hide and rename still work`.
**Acceptance** `pnpm test && pnpm test:db --filter ledger && pnpm openapi:check`
**Done when** a new family has working pickers on boards A4 and E2 and no emoji remain in the database.

### T-LED-03 · Visibility rule and ledger read facade
- **Closes:** GAP-REP-02, FR-TXN-05, FR-REP-06, DEC-18
- **Depends on:** T-LED-01
- **Milestone:** M2 · **Layer:** api
**Why** — Budgets, reports, Ask, festivals and CSV each rebuild the "not someone else's private entry" filter. One implementation prevents a leak.
**Files** C `modules/ledger/domain/visibility.ts`, `app/queries.ts`, `infra/query-repo.ts`, `app/on-family-deleted.ts`; M `index.ts`; M `apps/api/src/totals.ts` (moved to `modules/ledger/app/month-totals.ts`).
**Steps**
1. `visibility.ts`: `visibleTo(familyId, viewer: { userId: string } | "family")` returns a Drizzle SQL predicate: `family_id = $1 AND deleted_at IS NULL AND (is_private = false OR created_by = $user)`; for `"family"` it is `… AND is_private = false` (used for family-wide alerts and staff-safe counts).
2. Move `monthTotals` verbatim into `app/month-totals.ts` (same output shape `MonthTotals` with `byCategory`, `byMember`, `byAccount`); signature `getMonthTotals(familyId, viewer, month)`. Add `getRangeTotals(familyId, viewer, from, to)` for festivals (income, expense, byCategory).
3. Facade exports: `getMonthTotals`, `getRangeTotals`, `listVisibleTransactions(familyId, viewer, filter)` (cursor API from T-LED-05, used by CSV and Ask), `listCategories(familyId, { includeHidden })`, `listAccounts(familyId, { includeArchived })`, `assertRefs(familyId, { categoryId?, accountId? })` (replaces the three copies of `assertOwnedRefs` / `assertRefs`: throws `400 invalid_category` / `400 invalid_account`), `getCategoriesByKeys(familyId, keys)`, `getLastActivity(familyId): Promise<Date|null>` (`max(updated_at)` over transactions), `countTransactions(familyId)`.
4. `on-family-deleted.ts`: on `families.FamilyDeleted.v1` delete all rows of the family (transactions, accounts, categories, merchant rules) and storage keys under `receipts/{familyId}/`.
5. Replace each inline filter in `routes/*.ts` with the facade; grep must find no remaining `isPrivate, false` outside `modules/ledger`.
**Contract** `type Viewer = { userId: string } | "family"`.
**Tests** `modules/ledger/visibility.db.test.ts`: `viewer sees own private entries`; `viewer does not see others private entries`; `family viewer excludes all private entries`; `soft deleted rows are never visible`; `month totals include fee in expense`; `byMember groups by payer`; `assertRefs rejects another family's category`.
**Acceptance** `pnpm test:db --filter ledger && pnpm arch && ! grep -R "isPrivate, false" apps/api/src --include=*.ts | grep -v modules/ledger`
**Done when** the grep returns nothing and AC-07 still passes.

### T-LED-04 · Transaction use cases, HLC stamping and events
- **Closes:** FR-TXN-01, FR-TXN-04, FR-TXN-11, SRS §3.5 (ledger events), AC-04 (API half)
- **Depends on:** T-LED-03, T-FAM-08
- **Milestone:** M2 · **Layer:** api
**Why** — `routes/transactions.ts` mixes HTTP, authorisation, SQL and HLC stamping. The sync route repeats part of it. One use-case layer lets REST and sync share rules and publish events.
**Files** C `modules/ledger/app/{create-transaction,update-transaction,delete-transaction}.ts`, `domain/stamp.ts`, `http/transaction-routes.ts`; M `events.ts`, `index.ts`; D `apps/api/src/routes/transactions.ts`; M `apps/api/src/hlc.ts` → moved to `modules/ledger/domain/hlc.ts` (keep `hlc.test.ts` moving with it).
**Steps**
1. `domain/stamp.ts`: `stampChange(prevHlc?: string | null): { hlc: string; syncSeq: SQL }` = `{ hlc: nextHlc(prevHlc), syncSeq: bumpSyncSeq }`. Every insert and update of `transactions` in the module calls it (FR-TXN-11); a unit test greps the module for `.update(transactions)` and fails if the call is not within `stampChange` helpers.
2. `createTransaction(input, actor)` (actor = `{ userId, role }`): `families.requireRole(..., "member", { write: true })`; `ledger.assertRefs`; insert with `paidByUserId = input.paidByUserId ?? actor.userId` (admins may set another member; members may not — `403 forbidden`); `createdBy = actor.userId`; call `stampChange()`; all inside `ctx.db.transaction`, publishing `ledger.TransactionCreated.v1` through the outbox.
3. Idempotency and duplicates: a client-supplied `id` that already exists in the same family with the same `createdBy` returns `200` with the existing row (retry-safe); a different creator or family → `409 duplicate_id`. A unique violation on `txn_family_trx_uidx` (read `constraint_name` from the driver error, including `cause`) → `409 duplicate_trx_id` with `details.transactionId` of the existing row **only when it is visible to the caller**, else without details. Remove `.onConflictDoNothing()`.
4. `updateTransaction`: permission rule unchanged (`createdBy === actor || canEditAll(role)`), `stampChange(txn.hlc)`, publishes `ledger.TransactionUpdated.v1` including `before`. `deleteTransaction`: soft delete, `stampChange`, publishes `ledger.TransactionDeleted.v1`.
5. Event payloads in `events.ts`: `TransactionCreatedV1 = { familyId, transactionId, type, amountPaisa, feePaisa, categoryId|null, accountId|null, occurredAt, isPrivate, createdBy, paidByUserId, source, note|null }`; `TransactionUpdatedV1 = TransactionCreatedV1 & { kind: "edit"|"restore"; before: { type, amountPaisa, feePaisa, categoryId|null, occurredAt, isPrivate } }`; `TransactionDeletedV1 = TransactionCreatedV1`. Payloads contain no `counterparty`/`trxId`.
6. Keep URL and body shapes of `POST/PATCH/DELETE`. `POST` returns `201` for new rows.
**Contract** errors: `duplicate_trx_id` (409), `duplicate_id` (409), `invalid_category` (400), `invalid_account` (400), `forbidden` (403), `family_suspended` (423).
**Tests** `modules/ledger/transactions.db.test.ts`: `create stamps an hlc and a sync sequence`; `create publishes TransactionCreated in the same transaction` (rollback test: if publish fails no row exists); `same client id and creator returns 200 with the same row`; `same trxId returns duplicate_trx_id`; `duplicate details hidden for private rows`; `member cannot set paidByUserId to another user`; `admin can`; `member edits own but not others (403)`; `update bumps hlc above previous`; `delete sets deletedAt and publishes TransactionDeleted`; `viewer cannot create`; `suspended family returns 423`. `stamp.test.ts`: `module never updates transactions without stampChange`.
**Acceptance** `pnpm test:db --filter transactions && pnpm arch && pnpm openapi:check`
**Done when** AC-04 API assertions and the acceptance-7 role cases pass.

### T-LED-05 · Transaction list with filters and cursor pagination
- **Closes:** FR-TXN-02, GAP-LED-01, AC-14
- **Depends on:** T-LED-04
- **Milestone:** M2 · **Layer:** api
**Why** — Today `GET …/transactions` returns the latest 200 rows with only a `month` filter (`routes/transactions.ts` TODO).
**Files** C `modules/ledger/app/list-transactions.ts`, `domain/cursor.ts`, `domain/filter.ts`; M `http/transaction-routes.ts`; M `packages/shared/src/schemas.ts` (`ListTransactionsQuerySchema`, `TransactionPageSchema`).
**Steps**
1. Query schema: `month` (YYYY-MM), `from`/`to` (ISO dates, Asia/Dhaka days, max 24 months), `categoryId` (uuid), `memberId` (uuid, matches `paid_by_user_id`), `accountId` (uuid), `type`, `source`, `q` (max 50 chars; matched case-insensitively against `note` and `counterparty` with `ILIKE`, `%`/`_` escaped), `limit` (1–100, default 50), `cursor`.
2. Order: `occurred_at DESC, id DESC`. Cursor: `base64url(JSON.stringify({ t: occurredAt.toISOString(), id }))`; decoding errors → `400 invalid_cursor`. Keyset predicate: `(occurred_at, id) < ($t, $id)` using a row-value comparison. Fetch `limit + 1` rows to compute `nextCursor` (null when no more).
3. Response `{ items: TransactionListItem[], nextCursor: string|null }`. `TransactionListItem` adds `dayKey` (`YYYY-MM-DD` in Asia/Dhaka), `categoryNameBn/En`, `accountName`, `paidByName`, `isMine`, `hasAttachment`. Names resolve with `identity.getUsers` in one call; categories and accounts in one query each (no N+1).
4. Role: `member` or above (viewers use reports, FR-FAM-05). Visibility via `visibleTo`.
5. **Breaking change** (array → object): no client reads the list route today (mobile syncs, web has no list); update `apps/api/scripts/e2e.mjs` and the OpenAPI document in the same pull request.
**Tests** `modules/ledger/list.db.test.ts` with 120 seeded rows: `first page returns 50 and a cursor`; `three pages cover all 120 rows with no duplicates and no gaps`; `order is stable when many rows share occurredAt`; `filter by member`; `filter by account and category together`; `q matches note and counterparty case-insensitively`; `q escapes percent`; `month filter uses Asia/Dhaka boundaries` (row at 2026-10-31T18:30Z belongs to November); `private rows of others never appear in any page`; `invalid cursor returns 400`; `limit above 100 is rejected`; `viewer gets 403`.
**Acceptance** `pnpm test:db --filter list && pnpm openapi:check && EXPLAIN check: pnpm test:db --filter list-plan` (the plan test asserts the query uses `txn_family_time_idx`).
**Done when** AC-14 pagination assertions pass.

### T-LED-06 · Get one transaction
- **Closes:** FR-TXN-10
- **Depends on:** T-LED-05
- **Milestone:** M2 · **Layer:** api
**Why** — Detail screen D5 needs source, TrxID, attachment and what the caller may do.
**Files** C `app/get-transaction.ts`; M `http/transaction-routes.ts`.
**Steps** `GET /v1/families/:id/transactions/:txnId` returns the list item plus `{ trxId, counterparty, note, feePaisa, aiConfidence, source, attachmentUrl|null, splitGroupId|null, toAccountId|null, canEdit, canDelete, createdAt, updatedAt }`. `canEdit = createdBy === caller || canEditAll(role)`. Another member's private row → `404`. Deleted rows → `404` unless the caller could restore it (then `410 transaction_deleted` with `details.restorableUntil`).
**Tests** `returns canEdit true for own entry`; `returns canEdit false for another member's entry`; `private entry of another user is 404`; `deleted entry returns 410 with restorableUntil`; `viewer is 403`.
**Acceptance** `pnpm test:db --filter transaction-get && pnpm openapi:check`
**Done when** the Bangla message "আপনি শুধু নিজের খরচ বদলাতে পারেন" can be driven by `canEdit`.

### T-LED-07 · Restore deleted transactions and purge job
- **Closes:** FR-TXN-03, FR-PRIV-06 (transactions), GAP-LED-02, AC-14 (restore)
- **Depends on:** T-LED-04
- **Milestone:** M2 · **Layer:** api
**Why** — Screen D5 promises "৩০ দিন পর্যন্ত ফেরত পাবেন".
**Files** C `app/restore-transaction.ts`, `jobs.ts`; M `http/transaction-routes.ts`.
**Steps**
1. `POST /v1/families/:id/transactions/:txnId/restore` (member+, creator or admin). Finds the row with `deleted_at IS NOT NULL`; `deleted_at < now() - interval '30 days'` → `410 restore_window_passed`; else sets `deleted_at = NULL`, `stampChange(txn.hlc)`, publishes `TransactionUpdated` with `kind: "restore"`. Duplicate `trxId` clash after restore (another row took the id) → `409 duplicate_trx_id`.
2. Job `ledger.purge-deleted`, cron `15 3 * * *` Asia/Dhaka: delete rows where `deleted_at < now() - interval '31 days'` (one day beyond the 30-day restore window so sync tombstones live at least 30 days, SRS §4.3.1), deleting attachment objects first. Batch size 500 per run loop.
3. The job reports `{ purged }` to logs and a counter metric `ledger_purged_total`.
**Tests** `restore within 30 days returns the row to lists`; `restore after 30 days returns 410`; `member cannot restore another member's deletion`; `restore publishes TransactionUpdated kind restore`; `purge removes rows older than 31 days only` (fake clock at day 30, 31, 32); `purge deletes attachment objects`; `purge never touches live rows`.
**Acceptance** `pnpm test:db --filter restore && pnpm test:db --filter purge`
**Done when** AC-14 restore assertion passes.

### T-LED-08 · Account balances, archive rules, transfers
- **Closes:** FR-ACC-03, FR-ACC-04, GAP-LED-05
- **Depends on:** T-LED-04
- **Milestone:** M2 · **Layer:** api + shared
**Why** — Screen E1 shows balances; transfers between accounts need a destination.
**Files** C `domain/balance.ts`, `app/list-accounts.ts`; M `http/account-routes.ts`, `schema.ts`, `packages/shared/src/schemas.ts` (`toAccountId` in `CreateTransactionSchema`, `UpdateTransactionSchema`, `SyncTransactionSchema`); C migration.
**Steps**
1. Migration: `ALTER TABLE ledger.transactions ADD COLUMN to_account_id uuid REFERENCES ledger.accounts(id)`, `ADD CONSTRAINT transfer_needs_destination CHECK ((type = 'transfer') = (to_account_id IS NOT NULL))`. Schema: `toAccountId: z.uuid().nullable().optional()` with a refine `type === "transfer" ? toAccountId && toAccountId !== accountId : !toAccountId`. In `SyncTransactionSchema` the field is optional so existing mobile builds keep working.
2. Balance rule in `domain/balance.ts` (pure, in paisa): `balance = opening + Σ income.amount − Σ expense(amount+fee) − Σ transferOut(amount+fee) + Σ transferIn.amount`, over all non-deleted rows of the account **including private ones** (the balance must be true). `GET …/accounts` returns `balancePaisa` computed by one grouped query, but only for (a) accounts owned by the caller and (b) shared accounts when the caller is member or above; admins also see others' accounts; viewers and other members' personal accounts get `balancePaisa: null`. This decision is recorded in the PR.
3. `PATCH` archive: `archived: true` sets `archived_at`; archived accounts stay on old rows, are hidden by default (`includeArchived=false`) and cannot be chosen on new transactions (`400 invalid_account`). The last non-archived account cannot be archived (`409 last_account`).
**Contract** `AccountDto = { id, name, type, ownerUserId|null, openingBalancePaisa, balancePaisa|null, archivedAt|null }`.
**Tests** `domain/balance.test.ts`: `income and expense`; `fee reduces the balance`; `transfer moves money and fee leaves the source`; `opening balance counts`. DB: `private expense of another member still changes a shared balance but amount is not revealed in lists`; `balance null for other members' personal accounts`; `transfer requires a different destination`; `archived account rejected for new transactions`; `cannot archive the last account`.
**Acceptance** `pnpm test && pnpm test:db --filter account && pnpm openapi:check`
**Done when** E1 can show a balance for each visible account.

### T-LED-09 · Receipt attachments (presigned upload)
- **Closes:** FR-TXN-07, GAP-LED-03, GAP-ARCH-05 (ledger use)
- **Depends on:** T-LED-04, platform storage port
- **Milestone:** M7 · **Layer:** api
**Why** — The receipt endpoint reads a photo and forgets it; users want to keep it (D5, D6 "ছবি রাখুন").
**Files** C `app/attachments.ts`, `http/attachment-routes.ts`; M `schema.ts` (`attachment_key text`), migration; M `app/get-transaction.ts`.
**Steps**
1. `POST …/transactions/:txnId/attachment {contentType, bytes}` (creator or admin): validate `contentType ∈ {image/jpeg,image/png,image/webp}` and `bytes ≤ 5_242_880` (`413 attachment_too_large`, `415 attachment_type`); key `receipts/{familyId}/{txnId}/{uuidv7}.{ext}`; return `{ uploadUrl, headers: { "content-type": … }, key, expiresAt }` (presigned PUT, 10 minutes).
2. `POST …/attachment/confirm {key}`: key prefix must equal `receipts/{familyId}/{txnId}/`; `storage.head(key)` must exist with size ≤ 5 MB and matching type, else `422 attachment_missing`; set `attachment_key`, delete the previous object, `stampChange` is **not** applied (attachments are not synced), publish nothing.
3. `DELETE …/attachment` clears the key and deletes the object. `GET` of a transaction includes `attachmentUrl` (presigned GET, 5 minutes).
4. Transaction hard-delete (purge) and `FamilyDeleted` remove objects.
**Tests** `presign returns a url valid for ten minutes`; `oversize request returns 413`; `wrong type returns 415`; `confirm without upload returns 422`; `confirm with another transaction's key returns 422`; `replacing deletes the old object`; `non creator member gets 403`; `attachmentUrl absent after delete`. Uses the MinIO fake.
**Acceptance** `pnpm test:db --filter attachment && pnpm openapi:check`
**Done when** the receipt flow D6 can upload, confirm and show the image on D5.

### T-LED-10 · Split groups
- **Closes:** FR-TXN-08, AC-36 (ledger half)
- **Depends on:** T-LED-04, T-LED-09
- **Milestone:** M7 · **Layer:** api + shared
**Why** — One bazaar receipt often covers several categories (D6).
**Files** C `app/split-transaction.ts`, `http/split-routes.ts`; M `schema.ts` (`split_group_id uuid`, index `(family_id, split_group_id)`), migration; M `packages/shared/src/schemas.ts` (`CreateSplitSchema`, optional `splitGroupId` in sync schema).
**Steps**
1. `POST /v1/families/:id/transactions/split` body `{ occurredAt, accountId, note?, source, attachmentKey?, lines: [{ categoryId, amountPaisa, note? }] }` with 2–10 lines, each amount positive, total ≤ ৳1 crore. Creates **only child rows**, all with one new `split_group_id`; each child is a normal expense (counted once in category totals). No parent row exists, so reports never double count; the group total is the sum.
2. All children are created in one transaction, each stamped and each publishing `TransactionCreated`; the first child carries the attachment if given.
3. `GET …/transactions/split/:groupId` returns `{ groupId, totalPaisa, children[] }`; `DELETE …/transactions/split/:groupId` soft-deletes every child (creator or admin). Editing one child is allowed; it keeps its group.
4. List items include `splitGroupId`; the list never collapses groups (clients may group).
**Tests** `three lines create three children with one group id`; `children sum equals request total`; `reports count each child once` (month totals equal the sum, not double); `lines under two are rejected`; `delete group soft-deletes all`; `partial failure rolls back all children`; `group id appears in list items and sync wire`.
**Acceptance** `pnpm test:db --filter split && pnpm openapi:check`
**Done when** AC-36 ledger assertions pass.

### T-LED-11 · Merchant rules (CRUD and matcher)
- **Closes:** FR-AI-07, GAP-LED-04, AC-35 (ledger half)
- **Depends on:** T-LED-03
- **Milestone:** M7 · **Layer:** api
**Why** — Corrections like "Shwapno → Bazaar" must be remembered per family (D7) and applied before the AI.
**Files** C `domain/merchant.ts`, `app/merchant-rules.ts`, `http/merchant-rule-routes.ts`; M `schema.ts`, migration.
**Steps**
1. Table `ledger.merchant_rules(id uuid pk, family_id uuid not null, pattern text not null, category_id uuid not null references ledger.categories(id), created_by uuid not null, created_at timestamptz default now(), hits int not null default 0, last_hit_at timestamptz, unique (family_id, pattern))`.
2. `normalizeMerchant(text)`: lowercase (Latin), Unicode NFC, replace digits and punctuation by spaces, collapse whitespace, trim, max 60 chars; Bangla letters are kept. Example: `"Shwapno Dhanmondi 12"` → `"shwapno dhanmondi"`. Rules need at least 3 characters after normalising (`400 invalid_pattern`).
3. Routes: `GET /v1/families/:id/merchant-rules` (member+) → rules with category names and `hits`; `POST` `{ pattern, categoryId }` (member+; upsert by pattern; `ledger.assertRefs`; limit 200 per family → `409 rule_limit`); `DELETE …/:ruleId` (creator or admin).
4. Matcher facade: `matchMerchantRule(familyId, text): Promise<{ ruleId, categoryId, categoryKey, pattern } | null>`. Normalise the text; a rule matches when its pattern occurs in the text at token boundaries; the longest pattern wins, then the newest. A match increments `hits` and sets `last_hit_at` in a fire-and-forget update (failure ignored).
**Tests** `domain/merchant.test.ts`: `normalises Latin and keeps Bangla`; `too short pattern rejected`; `strips digits`. DB: `upsert replaces the category for the same pattern`; `longest pattern wins`; `matches at token boundaries only` ("ram" does not match "program"); `matcher returns null for no rule`; `rule from another family never matches`; `limit of 200 enforced`; `member can delete own rule but not another member's`.
**Acceptance** `pnpm test && pnpm test:db --filter merchant && pnpm openapi:check`
**Done when** `T-AI-05` can call `matchMerchantRule` and AC-35 ledger assertions pass.

---

# T-BUD · budgeting (`apps/api/src/modules/budgeting`)

### T-BUD-01 · Budgeting module, status words, unique-index fix
- **Closes:** GAP-ARCH-01 (budgeting), FR-BUD-01, FR-BUD-07
- **Depends on:** T-LED-03
- **Milestone:** M2 · **Layer:** api
**Why** — `routes/budgets.ts` computes spent amounts by calling `monthTotals`, with `effectiveBudgets` in `apps/api/src/budgets.ts`; the status needs words and icons for the design (B3), and the manual NULL-matching in `PUT` hides a schema flaw.
**Files** C `modules/budgeting/{index.ts,schema.ts,events.ts,jobs.ts}`, `domain/{level.ts,effective.ts,words.ts}`, `app/{get-budgets,put-budgets}.ts`, `http/budget-routes.ts`; D `apps/api/src/budgets.ts`, `routes/budgets.ts` (logic moves, tests move with it); C migration.
**Steps**
1. Move tables `budgets` and `festival_budgets` to `pgSchema("budgeting")`; drop the cross-schema FK `budgets.category_id → categories.id` (category validity is checked with `ledger.assertRefs` on write).
2. Replace the unique index with an expression index that treats the overall budget as one key: `DROP INDEX budget_family_cat_month_uidx; CREATE UNIQUE INDEX budget_family_cat_month_uidx ON budgeting.budgets (family_id, COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid), month);` Rewrite `PUT` as `INSERT … ON CONFLICT ON CONSTRAINT/INDEX … DO UPDATE SET limit_paisa = EXCLUDED.limit_paisa` (remove the manual matching loop).
3. Move `budgetLevel` and `effectiveBudgets` unchanged into `domain/level.ts` and `domain/effective.ts`, with their existing tests.
4. `domain/words.ts`: `statusWords(level, ctx): { level, icon: "check"|"warning"|"error", labelBn, labelEn, speechBn }` with labels `ঠিক আছে` / `সাবধান` / `বাজেট শেষ` (and English `OK` / `Careful` / `Over budget`). `speechBn` uses amounts in words from `packages/shared/src/words.ts` (the helper the monthly summary uses), never percentages: warning `"{খাত} খাতের বাজেট প্রায় শেষ"`, exceeded `"{খাত} খাতের বাজেট শেষ, {X} টাকা বেশি"`.
5. `GET /v1/families/:id/budgets` response keeps `level` and adds `status` (the object above) and `remainingPaisa`. Spent amounts use `ledger.getMonthTotals(familyId, { userId }, month)` so a viewer's own private entries stay theirs.
6. Facade: `getBudgetStatus(familyId, viewer, month)`, `getEffectiveBudgets(familyId, month)` for the alert engine and the sync reference bundle.
**Tests** moved `level.test.ts`, `effective.test.ts`; new: `words.test.ts` (`exceeded speech names the overage in words`, `warning speech has no digits or percent sign`); `budget-routes.db.test.ts`: `put creates overall and category budgets`; `put twice updates instead of duplicating the overall row`; `inherits last month's budget with inherited true`; `limit zero clears`; `unknown category is rejected`; `viewer can read but not put (403)`.
**Acceptance** `pnpm test && pnpm test:db --filter budget && pnpm openapi:check && pnpm arch`
**Done when** B3 can render label, icon and spoken text from one response.

### T-BUD-02 · Alert engine (80% and 100%, once per month)
- **Closes:** FR-BUD-02, FR-BUD-05, GAP-BUD-01, AC-05
- **Depends on:** T-BUD-01, T-LED-04
- **Milestone:** M2 · **Layer:** api
**Why** — Nothing fires alerts today; budgets only compute levels when read.
**Files** C `app/evaluate-alerts.ts`, `app/on-transaction-changed.ts`, `domain/thresholds.ts`; M `schema.ts`, `events.ts`; C migration.
**Steps**
1. Table `budgeting.budget_alerts(id uuid pk, family_id uuid not null, budget_key text not null, month text not null, threshold smallint not null check (threshold in (80,100)), spent_paisa bigint not null, limit_paisa bigint not null, fired_at timestamptz default now(), unique (family_id, budget_key, month, threshold))` where `budget_key` is `'overall'` or the category uuid.
2. Subscribe to `ledger.TransactionCreated/Updated/Deleted.v1` (handler id `budgeting.evaluate`). Affected keys: `'overall'` plus the transaction's category and, on updates, the `before` category; affected month = Asia/Dhaka month of `occurredAt` (and of `before.occurredAt`). Only **expense** rows and only the **current Dhaka month** are evaluated (older months never alert).
3. Spent amount for evaluation uses **family-visible** spending: `ledger.getMonthTotals(familyId, "family", month)` (private entries are excluded so an alert never discloses private spending). Compute `ratio = spent / limit` for the effective budget (`getEffectiveBudgets`).
4. For each threshold reached (80, 100) not yet in `budget_alerts`: insert with `ON CONFLICT DO NOTHING RETURNING`; **only when a row was inserted** publish `budgeting.BudgetThresholdCrossed.v1`. A single large expense that jumps from below 80% to above 100% fires both thresholds, 80 first.
5. Payload: `BudgetThresholdCrossedV1 = { familyId, budgetKey, categoryId|null, categoryNameBn, categoryNameEn, month, threshold: 80|100, level: "warning"|"exceeded", spentPaisa, limitPaisa }`. Recipients are chosen by notifications (owner and admins; members optional, FR-NOT-01).
6. Deletes or edits that lower spending never remove alerts (once per month by design); a new month starts with no rows.
7. Job `budgeting.purge-alerts` (cron `0 4 1 * *`): delete rows older than 3 months.
**Tests** `alert-engine.db.test.ts`: `no alert below 80 percent`; `crossing 80 fires one warning`; `crossing 100 fires one exceeded`; `two more expenses after 100 fire nothing`; `a jump past both thresholds fires 80 then 100`; `private expense of a member does not count toward alerts`; `category budget and overall budget alert independently`; `editing an expense to another category evaluates both categories`; `next month starts fresh`; `replaying the same event publishes nothing twice`; `budget with limit zero never alerts`. AC-05: seed ৳10,000 bazaar budget, add ৳7,900 (no alert), then ৳200 (one warning), then ৳2,000 (one exceeded).
**Acceptance** `pnpm test:db --filter alert-engine && pnpm arch`
**Done when** AC-05 passes with exactly one event per threshold.

### T-BUD-03 · Month-start carry-forward job
- **Closes:** FR-BUD-03, GAP-BUD-02
- **Depends on:** T-BUD-01
- **Milestone:** M2 · **Layer:** api
**Why** — `effectiveBudgets` already inherits last month's limits when a month has no row (read-time carry-forward), but stored rows make reports, export and the alert engine independent of history and keep the "inherited" flag honest.
**Files** C `jobs.ts`, `app/carry-forward.ts`; M `schema.ts` (`source text not null default 'manual' check (source in ('manual','carried'))`), migration.
**Steps**
1. Job `budgeting.carry-forward`, cron `5 0 1 * *` (`tz: "Asia/Dhaka"`, 00:05 on the 1st). For every family with at least one budget row in the previous month: for each effective budget (`effectiveBudgets(rows, currentMonth)` with `inherited: true`) insert `(family_id, category_id, month = current, limit_paisa, source = 'carried')` `ON CONFLICT DO NOTHING`. Limit-zero (cleared) budgets are not carried.
2. Publish `budgeting.BudgetsCarriedForward.v1 { familyId, month, count }` once per family that got rows (notifications may mention it in the inbox; not required).
3. Process families in pages of 200 using `ctx.jobs` batching so a long run can resume; the job is idempotent and safe to run twice.
4. `GET /v1/families/:id/budgets` returns `inherited: false` for carried rows but includes `carried: true` so the UI can say "গত মাসের বাজেট".
**Tests** `carry-forward.db.test.ts`: `copies last month's budgets on the first`; `does not overwrite a budget set manually`; `skips cleared budgets`; `running twice creates no duplicates`; `families with no previous budgets get nothing`; `job is scheduled with Asia/Dhaka timezone` (inspect registered schedule); `event published once per family`.
**Acceptance** `pnpm test:db --filter carry-forward`
**Done when** FR-BUD-03 holds both at read time and after the job.

### T-BUD-04 · Festival budgets: suggested split and per-category lines
- **Closes:** FR-BUD-04 (E4)
- **Depends on:** T-BUD-01
- **Milestone:** M7 · **Layer:** api
**Why** — Screen E4 proposes how to split a festival limit across categories.
**Files** C `domain/festival-presets.ts`, `app/suggest-split.ts`, `app/festival-lines.ts`, `http/festival-routes.ts`; M `schema.ts` (table `festival_budget_lines`); D `routes/festivals.ts`; M `packages/shared/src/schemas.ts`.
**Steps**
1. Presets (weights sum to 100; keys exist in `DEFAULT_CATEGORIES`): `eid_adha`: festival 40, bazaar 25, clothing 20, charity 15; `eid_fitr`: clothing 35, bazaar 30, festival 20, charity 15; `puja`: festival 35, bazaar 25, clothing 25, gifts 15; `custom`: bazaar 50, festival 50.
2. `GET /v1/families/:id/festival-budgets/suggest?limitPaisa=&preset=` (member+ read): returns `{ preset, lines: [{ categoryId, nameBn, nameEn, weightPercent, suggestedPaisa }] }` using `ledger.getCategoriesByKeys`; missing or hidden categories are skipped and their weight is redistributed proportionally. Amounts use the **largest-remainder method** so the lines sum exactly to `limitPaisa`.
3. Table `budgeting.festival_budget_lines(festival_id uuid references budgeting.festival_budgets(id) on delete cascade, category_id uuid not null, limit_paisa bigint not null, primary key (festival_id, category_id))`. `POST/PATCH festival-budgets` accept optional `lines`; the sum must be ≤ the festival limit (`400 lines_exceed_limit`). `GET` returns each line with `spentPaisa` and `status` words computed with `ledger.getRangeTotals`.
4. Move the existing festival routes unchanged otherwise (including `endsOn ≥ startsOn` checks and the `level` field).
**Tests** `domain/festival-presets.test.ts`: `weights sum to 100`; `largest remainder sums exactly` (limit ৳20,001 → lines sum 2,000,100 paisa); `missing category redistributes weight`. DB: `suggest returns lines for eid_adha`; `lines above the limit are rejected`; `festival line spent counts only transactions in range`; `viewer reads but cannot create`; `existing festival tests still pass`.
**Acceptance** `pnpm test && pnpm test:db --filter festival && pnpm openapi:check`
**Done when** E4 can prefill and save a festival budget with category lines.

---

# T-REC · recurring (`apps/api/src/modules/recurring`)

### T-REC-01 · Recurring module, skip endpoint
- **Closes:** GAP-ARCH-01 (recurring), FR-REC-01, FR-REC-02
- **Depends on:** T-LED-04
- **Milestone:** M7 · **Layer:** api
**Why** — Screen E3 lets a user skip this month's bill ("✗"); there is no skip today. The pure rules live in `apps/api/src/recurring.ts` (`dueDateIn`, `isDueIn`, `reminderState`).
**Files** C `modules/recurring/{index.ts,schema.ts,events.ts,jobs.ts}`, `domain/due.ts` (moved from `src/recurring.ts` with its tests), `app/{list,create,update,skip}.ts`, `http/recurring-routes.ts`; D `routes/recurring.ts`, `src/recurring.ts`; C migration.
**Steps**
1. Move `recurring_templates` to `pgSchema("recurring")`; drop FKs to `ledger.categories/accounts` and `identity.users`; validation uses `ledger.assertRefs`.
2. Table `recurring.recurring_skips(template_id uuid references recurring.recurring_templates(id) on delete cascade, month text not null, skipped_by uuid not null, skipped_at timestamptz default now(), primary key (template_id, month))`.
3. Change `isDueIn(t, month, skippedMonths: ReadonlySet<string> = new Set())`: a skipped month is not due. `reminderState` passes the set through. Callers load skips with one query per request.
4. `POST /v1/families/:id/recurring/:recurringId/skip?month=` (member+): inserts the skip (idempotent), returns `{ skipped: true, month }`; `409 already_confirmed` if the month is confirmed. `DELETE …/skip?month=` undoes it (same roles).
5. `GET …/drafts` and `GET …/reminders` exclude skipped months and keep their existing JSON.
6. All mutating routes pass `{ write: true }` to `families.requireRole`.
**Tests** moved `due.test.ts` plus `skipped month is not due`, `skipped month is not reminded`; DB `recurring-routes.db.test.ts`: `skip hides the draft`; `skip is idempotent`; `unskip restores the draft`; `skip after confirm returns 409`; `viewer cannot skip`; `drafts for another family are 404`.
**Acceptance** `pnpm test && pnpm test:db --filter recurring && pnpm openapi:check && pnpm arch`
**Done when** E3 can show confirm and skip actions.

### T-REC-02 · Bill reminder job (09:00 Asia/Dhaka)
- **Closes:** FR-REC-03, FR-NOT-03, GAP-REC-01
- **Depends on:** T-REC-01
- **Milestone:** M7 · **Layer:** api
**Why** — `GET …/reminders` is readable but nothing pushes it.
**Files** C `jobs.ts`, `app/send-reminders.ts`; M `schema.ts`, `events.ts`; C migration.
**Steps**
1. Table `recurring.reminders_sent(template_id uuid, month text, kind text check (kind in ('before','due')), sent_at timestamptz default now(), primary key (template_id, month, kind))`.
2. Job `recurring.remind`, cron `0 9 * * *`, `tz: "Asia/Dhaka"`. Compute `today` as the Dhaka date from `ctx.clock.now()`. Page through active templates (200 per page). For each, compute `due = dueDateIn(month, dayOfMonth)`; `before` reminder when `today === due − remindDaysBefore` and the month is neither confirmed nor skipped; `due` reminder when `today === due` and still unconfirmed.
3. Insert into `reminders_sent … ON CONFLICT DO NOTHING RETURNING`; only if inserted publish `recurring.BillDue.v1`.
4. Payload `BillDueV1 = { familyId, templateId, name, amountPaisa, dueOn, daysUntil, kind: "before"|"due" }`; notifications turns it into a push and inbox item (FR-NOT-03).
5. Templates with `remindDaysBefore = 0` send only the `due` kind.
**Tests** `reminder fires on due minus two days`; `reminder fires on the due day if unconfirmed`; `confirmed month sends no due reminder`; `skipped month sends nothing`; `running the job twice sends once`; `short month uses the last day` (day 31 in November → Nov 30); `inactive template sends nothing`; `job schedule uses Asia/Dhaka and 09:00`.
**Acceptance** `pnpm test:db --filter recurring-remind`
**Done when** the fake push sink receives one message per template per kind per month.

### T-REC-03 · Confirm through the ledger facade, idempotently
- **Closes:** FR-REC-02, SRS §3.4 R4
- **Depends on:** T-REC-01, T-LED-04
- **Milestone:** M7 · **Layer:** api
**Why** — The confirm route inserts into `transactions` directly (`routes/recurring.ts`), bypassing HLC stamping rules, events and the module boundary.
**Files** M `app/confirm.ts`, `http/recurring-routes.ts`.
**Steps**
1. `confirm(templateId, month, actor, overrides?: { amountPaisa?: number; paidByUserId?: string })`: loads the template `FOR UPDATE`; `isDueIn` false → `409 not_due`; builds a **deterministic** transaction id `uuidv5("recurring:" + templateId + ":" + month, NAMESPACE_RECURRING)`; calls `ledger.createTransaction({ id, type, amountPaisa, occurredAt: due date 12:00 +06:00, categoryId, accountId, note: name, source: "manual" }, actor)`.
2. Because the ledger returns `200` with the existing row for the same id and creator, a retry after a crash between the ledger insert and the template update is safe. After the ledger call, set `last_confirmed_month = month` in the recurring schema.
3. Body `{ amountPaisa? }` lets the user enter the real bill (E3 "দেওয়া হয়েছে?" with an edited amount); default is the template amount.
4. Second confirm for the same month → `409 not_due` as today.
**Tests** `confirm creates one transaction through the ledger`; `confirm twice returns not_due and creates one row`; `crash between ledger and template update is repaired by retry` (simulate failure after ledger call); `override amount is used`; `deterministic id equals uuidv5 of template and month`; `viewer gets 403`; `suspended family gets 423`.
**Acceptance** `pnpm test:db --filter recurring-confirm && pnpm arch`
**Done when** no file in `modules/recurring` imports ledger tables or `hlc`.

---

# T-AI · ai (`apps/api/src/modules/ai` and `packages/ai`)

### T-AI-01 · AI module, ports, and moved routes
- **Closes:** GAP-ARCH-01 (ai), FR-AI-01..FR-AI-06, FR-AI-11
- **Depends on:** T-LED-03, T-FAM-01
- **Milestone:** M2 · **Layer:** api
**Why** — `routes/ai.ts` talks to Drizzle tables of other modules, builds the Claude client inline and mixes quota, parse, summary, Ask and receipt in 200 lines.
**Files** C `modules/ai/{index.ts,schema.ts,events.ts,jobs.ts}`, `http/{parse,summary,ask,receipt}-routes.ts`, `app/{parse,summary,ask,receipt,quota}.ts`, `infra/claude-client.ts` (port + adapter), `infra/fake-claude.ts` (re-export of `tools/fakes`); D `routes/ai.ts`; C migration.
**Steps**
1. Move `ai_usage` and `ai_summaries` to `pgSchema("ai")`; drop the FK to families. Keep their columns and the summary cache logic (hash of aggregates; only AI summaries are cached).
2. Port `ClaudeClient { enabled: boolean; client?: Anthropic; model?: string }` built from `AppDeps.anthropic` and `aiModel`; the fake returns canned JSON by prompt fingerprint.
3. Inputs from other modules come only through facades: categories → `ledger.listCategories(familyId, { includeHidden: false })`; totals → `ledger.getMonthTotals(familyId, { userId }, month)`; Ask tools (`sumByCategory`, `compareMonths`, `listTransactions`) → `ledger.getMonthTotals` and `ledger.listVisibleTransactions`; role checks → `families.requireRole`.
4. Keep the routes, bodies and responses exactly as in `routes/ai.ts`: `POST …/ai/parse`, `GET …/ai/summary`, `POST …/ai/ask`, `POST …/ai/receipt` (body limit 8 MB). Mutating-style routes (`parse`, `ask`, `receipt`) pass `{ write: true }` only for the quota counter writes; reading `summary` does not.
5. Move `hasAiQuota` and `recordAiUse` into `app/quota.ts` unchanged for now (T-AI-02 and T-AI-03 replace them).
**Tests** moved route tests; new `ai-routes.db.test.ts`: `parse of a bKash SMS never calls the Claude fake` (call counter 0, AC-03); `parse of "bazar 850 cash" uses the quick parser without AI`; `summary cache returns the same text and makes no second AI call`; `viewer can read summary but not parse`; `ask rejects viewers`; `receipt without client returns 503 ai_unavailable`; `parse with another family's id is 404`.
**Acceptance** `pnpm test && pnpm test:db --filter ai && pnpm arch && pnpm openapi:check`
**Done when** no file in `modules/ai` imports `drizzle` tables owned by other modules.

### T-AI-02 · Usage metering (feature, tokens, latency, errors)
- **Closes:** FR-AI-14, GAP-AI-01, NFR-13
- **Depends on:** T-AI-01
- **Milestone:** M2 · **Layer:** api + packages/ai
**Why** — `ai_usage` counts requests only; the admin console and the ৳15 cost goal need tokens and latency per feature.
**Files** M `packages/ai/src/llm.ts`, `receipt.ts`, `ask.ts`, `summary.ts`, `index.ts` (add `onUsage`); C `modules/ai/app/metering.ts`; M `schema.ts`; C migration; C `packages/ai/src/usage.test.ts`.
**Steps**
1. In `packages/ai` define `export type AiUsage = { inputTokens: number; outputTokens: number; latencyMs: number }` and add an optional `onUsage?: (u: AiUsage) => void` to `parseWithLlm`, `parseReceipt`, `askQuestion` and `monthlySummary` options. Each calls it once per Claude request with `response.usage.input_tokens/output_tokens` and measured wall time; for tool loops (Ask) it is called per round trip.
2. Migration: `ALTER TABLE ai.ai_usage ADD COLUMN feature text NOT NULL DEFAULT 'legacy', ADD COLUMN input_tokens bigint NOT NULL DEFAULT 0, ADD COLUMN output_tokens bigint NOT NULL DEFAULT 0, ADD COLUMN latency_ms_sum bigint NOT NULL DEFAULT 0, ADD COLUMN errors int NOT NULL DEFAULT 0; ALTER TABLE ai.ai_usage DROP CONSTRAINT ai_usage_pkey, ADD PRIMARY KEY (family_id, month, feature);` Allowed features: `parse`, `receipt`, `ask`, `summary`, `legacy`.
3. `withMetering(feature, familyId, fn)`: runs `fn(onUsage)`, then upserts `requests = requests + 1` (when the call used AI), token sums and `latency_ms_sum` in one statement; on `AiUnavailableError` increments `errors` instead. No prompt, answer or user text is ever stored (SRS §5.2).
4. Replace `recordAiUse(db, familyId)` calls with `withMetering`.
5. Month usage total for quota = sum of `requests` over features.
**Tests** `usage.test.ts` (packages/ai): `onUsage is called with tokens and latency`; `Ask reports one entry per round trip`. DB: `parse records feature parse with tokens`; `unavailable response increments errors not requests`; `summary template path records nothing`; `two features in one month keep separate rows`; `no text columns exist in ai_usage` (schema inspection).
**Acceptance** `pnpm test && pnpm test:db --filter metering && pnpm db:generate --name ai_usage_features --check`
**Done when** `SELECT feature, sum(requests) FROM ai.ai_usage` explains a month's cost.

### T-AI-03 · Quota from entitlements, structured 429, quota flag on parse
- **Closes:** FR-AI-12, AC-39 (ai half), DEC-10
- **Depends on:** T-AI-02, T-FAM-09
- **Milestone:** M2 · **Layer:** api + shared
**Why** — Quota comes from `families.ai_quota_month` read inline; the app (E7) needs to know used, limit and reset date, and parse should tell the app when AI was skipped only because of quota.
**Files** M `app/quota.ts`; C `app/entitlements-port.ts`; M `packages/shared/src/schemas.ts` (`ParseResponseSchema` adds `quotaExhausted: z.boolean().optional()`); M `http/*-routes.ts`.
**Steps**
1. Port `EntitlementsPort.get(familyId): { aiQuotaMonth: number; features: { receipt: boolean; ask: boolean } }`. Default adapter reads `families.getFamilyLimits(familyId)` (facade added in T-FAM-09: `{ memberLimit, aiQuotaMonth }`) and returns both features `true` while flag `billing_enforced` is off (billing is P3). When the flag is on and a feature is false → `403 plan_feature` with `details.feature`.
2. `checkQuota(familyId): { used, limit, remaining, resetsOn }` where `used` sums `ai_usage.requests` for the Dhaka month and `resetsOn` is the first day of next month.
3. Over quota: Ask and receipt → `429 ai_quota` with `details: { used, limit, resetsOn }`; parse → keeps deterministic parsers and returns the amount-only draft with `quotaExhausted: true`; summary → template (unchanged).
4. Atomic reservation (prevents bursts overshooting): `reserve(familyId, feature)` runs `INSERT … ON CONFLICT (family_id, month, feature) DO UPDATE SET requests = requests + 1 WHERE (SELECT coalesce(sum(requests),0) FROM ai.ai_usage WHERE family_id = $1 AND month = $2) < $limit RETURNING requests`; no row → denied. A failed AI call calls `release` (decrement) so errors never burn quota.
**Tests** `parse over quota returns amount-only draft and quotaExhausted true`; `ask over quota returns 429 with used limit resetsOn`; `ten parallel parses with one remaining use only one AI call`; `failed AI call releases the reservation`; `receipt blocked with plan_feature when billing_enforced and plan lacks it`; `quota resets in a new Dhaka month` (fake clock).
**Acceptance** `pnpm test:db --filter quota && pnpm openapi:check`
**Done when** screen E7's quota card can be driven by the 429 details and the parse flag.

### T-AI-04 · Daily cost ceiling
- **Closes:** FR-AI-15, NFR-13
- **Depends on:** T-AI-03
- **Milestone:** M7 · **Layer:** api
**Why** — A bug or abusive client could burn a month's quota in minutes and the AI bill with it.
**Files** C `app/daily-ceiling.ts`; M `schema.ts` (table `ai.ai_usage_daily(family_id uuid, day date, requests int, primary key (family_id, day))`), migration; M `app/quota.ts`.
**Steps** 1. `dailyCeiling(monthlyQuota) = Math.max(5, Math.ceil(3 * monthlyQuota / 30))` (Free 100 → 10, Plus 1,000 → 100). 2. `reserve` also increments `ai_usage_daily` with the same conditional-upsert pattern; either limit failing denies and rolls back the other. 3. Over the daily ceiling → `429 ai_daily_limit` with `details: { limit, resetsAt }` (next 00:00 Asia/Dhaka). Parse degrades like monthly exhaustion. 4. Metric `ai_daily_ceiling_hits_total` (platform metrics) and a facade `countCeilingHitsToday()` for system health (FR-ADM-10). 5. Job `ai.purge-daily` (cron `30 4 * * *`): delete `ai_usage_daily` older than 40 days.
**Tests** `ceiling formula for 100 and 1000`; `eleventh call in a day is denied on the Free plan`; `daily and monthly reservations roll back together`; `resetsAt is the next Dhaka midnight`; `ceiling hit increments the counter`.
**Acceptance** `pnpm test:db --filter daily-ceiling`
**Done when** a runaway client is stopped at the daily limit in tests.

### T-AI-05 · Merchant rule step in the pipeline, `ruleApplied`
- **Closes:** FR-AI-07, AC-35
- **Depends on:** T-LED-11, T-AI-01
- **Milestone:** M7 · **Layer:** api + packages/ai + shared
**Why** — A learned rule must be used before spending an AI request (SRS §7.2).
**Files** M `packages/ai/src/index.ts` (`parseInput`), `packages/ai/src/rules.ts` (helper `applyRule`); M `packages/shared/src/schemas.ts` (`TransactionDraftSchema.ruleApplied`); M `modules/ai/app/parse.ts`; C `packages/ai/src/merchant-rule.test.ts`.
**Steps**
1. Draft field: `ruleApplied: z.object({ ruleId: z.uuid(), pattern: z.string() }).nullable().optional()` (additive, old clients ignore it).
2. `ParseInputOptions` gains `matchRule?: (text: string) => Promise<{ ruleId: string; pattern: string; categoryKey: string } | null>`.
3. Pipeline order in `parseInput`: SMS parser → quick parser (complete) → **merchant rule** → LLM → partial quick draft. Concretely: after the quick parser returns a partial draft (amount found, no category) and a rule matches, return the draft with `categoryKey` from the rule, `confidence: 0.9`, `ruleApplied` set and **no AI call**. If no amount was found, continue to the LLM; after the LLM returns drafts, apply the rule to each draft whose note or counterparty matches (the rule overrides the model's category) and set `ruleApplied`.
4. `modules/ai/app/parse.ts` passes `matchRule = (t) => ledger.matchMerchantRule(familyId, t)`.
**Tests** `packages/ai`: `rule completes a partial quick draft without calling the model`; `rule overrides the model category`; `no rule leaves the pipeline unchanged`; `SMS drafts are not altered by rules`. API: AC-35 — `after POST merchant-rules, parse "Shwapno 850" returns bazaar with ruleApplied and the Claude fake was called zero times`; `rule from another family is not applied`.
**Acceptance** `pnpm test && pnpm test:db --filter ai-rule && pnpm openapi:check`
**Done when** AC-35 passes.

### T-AI-06 · Receipt split suggestions
- **Closes:** FR-AI-09, FR-TXN-08, AC-36 (ai half)
- **Depends on:** T-AI-01, T-LED-10
- **Milestone:** M7 · **Layer:** api + packages/ai + shared
**Why** — Screen D6 shows lines by category with a total; today the prompt asks for one draft per receipt (`packages/ai/src/receipt.ts` `RECEIPT_PROMPT`).
**Files** M `packages/ai/src/receipt.ts`, `llm.ts` (`LlmDraftsSchema` + new `LlmReceiptSchema`); M `packages/shared/src/schemas.ts` (`ReceiptResponseSchema`); M `modules/ai/app/receipt.ts`, `http/receipt-routes.ts`; C `packages/ai/src/receipt-split.test.ts`.
**Steps**
1. Extend the model schema with optional `lines: [{ description, amountTaka, categoryKey|null }]` (max 10) beside the total draft. Update the prompt: "Also return line groups only when the receipt clearly lists several kinds of goods; the lines must add up to the total."
2. `parseReceipt` returns `{ drafts, split?: { totalPaisa, lines: [{ note, amountPaisa, categoryKey }] } }`. The server converts taka to paisa and **drops `split` unless the line amounts sum exactly to the single draft's `amountPaisa`** (guards model arithmetic errors).
3. Endpoint response `{ drafts, usedAi: true, split? }`; the app can then call `POST …/transactions/split` (T-LED-10).
4. The image is read once; the module does not store it (clients upload an attachment separately, T-LED-09).
**Tests** `packages/ai`: `three line receipt returns split whose sum equals the total` (fixture); `mismatched sum drops the split`; `single line receipt returns no split`; `categoryKey outside the family's list becomes null`. API with the Claude fake: `receipt response includes split`; `AC-36 flow: receipt → split request → three children sum to total`.
**Acceptance** `pnpm test && pnpm test:db --filter receipt && pnpm openapi:check`
**Done when** AC-36 passes end to end.

### T-AI-07 · Usage endpoint and staff-safe usage facade
- **Closes:** FR-AI-14, FR-ADM-02/07 (data), E7
- **Depends on:** T-AI-02, T-AI-04
- **Milestone:** M5 · **Layer:** api
**Why** — The app shows "৯৩ / ১০০" on E7 and staff need families near quota and cost per family.
**Files** C `http/usage-routes.ts`, `app/usage.ts`; M `index.ts`, `src/env.ts` (`AI_PRICE_IN_PER_MTOK_BDT`, `AI_PRICE_OUT_PER_MTOK_BDT`, default 0).
**Steps**
1. `GET /v1/families/:id/ai/usage?month=` (viewer+) → `{ month, used, limit, remaining, resetsOn, byFeature: { parse, receipt, ask, summary }, dailyUsed, dailyLimit }`.
2. Facade (all `@staff-safe`): `getFamilyAiUsage(familyId, month)`, `listFamiliesNearQuota({ threshold: 0.9, limit, cursor })` → `[{ familyId, used, limit }]`, `getCostPerActiveFamily(month)` → `{ activeFamilies, totalCostBdt, perFamilyBdt }` using token sums × price env (integer paisa maths; "active" = a family with ≥ 1 transaction that month, from `ledger.countActiveFamilies(month)` added to the ledger facade), `countCeilingHitsToday()`, `countAiErrorsAndFallbacks(range)`.
3. Types contain only counts and ids (checked by the private-fields type test).
**Tests** `usage endpoint returns per feature counts`; `viewer can read usage`; `near quota lists families at 90 percent and above`; `cost per active family uses tokens and prices`; `facade types contain no private fields`.
**Acceptance** `pnpm test:db --filter ai-usage && pnpm openapi:check && pnpm arch`
**Done when** the admin Plans and Overview screens (G1, C1) can be built from facades alone.

---

# T-REP · reporting (`apps/api/src/modules/reporting`)

### T-REP-01 · Reporting module and ledger series facade
- **Closes:** GAP-ARCH-01 (reporting), FR-REP-01, FR-REP-02, FR-REP-06
- **Depends on:** T-LED-03
- **Milestone:** M2 · **Layer:** api
**Why** — `routes/reports.ts` queries `transactions` directly (the remittance report, 40 lines of raw SQL) and duplicates visibility.
**Files** C `modules/reporting/{index.ts,schema.ts,events.ts,jobs.ts}` (`schema.ts` only declares `pgSchema("reporting")` for the architecture rule), `http/report-routes.ts`, `app/{month-summary,remittances}.ts`; C `modules/ledger/app/series.ts` (+ facade export `getMonthlySeries`); D `routes/reports.ts`.
**Steps**
1. Ledger facade: `getMonthlySeries(familyId, viewer, fromMonth, toMonth): Promise<{ month; incomePaisa; expensePaisa; byCategoryKey: Record<string, { incomePaisa; expensePaisa }> }[]>` using one grouped query on `to_char(occurred_at at time zone 'Asia/Dhaka','YYYY-MM')` and `categories.key`; months with no data are returned as zeros (uses `monthsBetween` from `month.ts`, moved to `modules/ledger/domain/month.ts` and re-exported by `platform` as `dhaka` helpers).
2. `GET …/reports/summary` keeps its shape (`MonthSummarySchema`: `byCategory`, `byMember`, `byAccount`, `previous`) and uses `ledger.getMonthTotals` for the month and the previous month.
3. `GET …/reports/remittances` keeps its current shape; its SQL is replaced by `getMonthlySeries` over category key `remittance`. T-REP-03 refines it.
4. Every report requires `viewer+` except CSV (`member+`), exactly as today; none mutates, so no `write` flag.
5. Delete `apps/api/src/totals.ts`, `month.ts` after all importers moved (`month.ts` functions move into `modules/ledger/domain/month.ts`; ai, budgeting and recurring import them through the ledger facade or `platform/dhaka.ts`).
**Tests** moved report tests; new `reporting-routes.db.test.ts`: `summary excludes other members' private entries`; `summary includes the caller's own private entries`; `previous month totals match`; `byMember and byAccount sum to expense`; `getMonthlySeries returns zeros for empty months`; `viewer gets summary but not CSV`; `family B user gets 404`.
**Acceptance** `pnpm test:db --filter reporting && pnpm arch && pnpm openapi:check`
**Done when** `grep -R "transactions" apps/api/src/modules/reporting` finds nothing.

### T-REP-02 · Trend endpoint (6 and 12 months)
- **Closes:** FR-REP-03, GAP-REP-01, AC-38
- **Depends on:** T-REP-01
- **Milestone:** M7 · **Layer:** api + shared
**Why** — Screen E5 has a 6/12-month bar trend; no endpoint exists.
**Files** C `app/trend.ts`, `http/trend-route.ts`; M `packages/shared/src/schemas.ts` (`TrendQuerySchema`, `TrendResponseSchema`).
**Steps**
1. `GET /v1/families/:id/reports/trend?months=6|12&categoryId=&to=YYYY-MM` (viewer+; aggregates only). `to` defaults to the current Dhaka month; the window is `months` months ending at `to`.
2. Response `{ from, to, months: [{ month, incomePaisa, expensePaisa }], categories: [{ categoryId, nameBn, nameEn, series: [{ month, expensePaisa }] }] }`. Without `categoryId` the response contains the **top 5 categories by total expense** in the window; with `categoryId` it contains only that category (unknown category → `400 invalid_category`).
3. Missing months are zero-filled so charts need no gap logic.
4. Uses `ledger.getMonthlySeries` once (no per-month queries) and `ledger.listCategories` for names.
**Tests** `six month default returns six entries oldest first`; `twelve month returns twelve`; `empty months are zero`; `top five categories sorted by total`; `categoryId limits the response`; `private entries of others excluded`; `months=7 returns 400`; `to beyond the current month is allowed but returns zeros`.
**Acceptance** `pnpm test:db --filter trend && pnpm openapi:check`
**Done when** AC-38 passes.

### T-REP-03 · Viewer remittance report (summary-only)
- **Closes:** FR-REP-05, FR-FAM-05, BR-13
- **Depends on:** T-REP-01
- **Milestone:** M7 · **Layer:** api
**Why** — Tanvir (E6) sees remittances against spending with running balances and never individual entries.
**Files** M `app/remittances.ts`, `http/report-routes.ts`; M `packages/shared/src/schemas.ts` (`RemittanceReportSchema`).
**Steps**
1. Keep the endpoint and the 24-month limit and defaults of today (`from`, `to`, six-month window). New response: `{ from, to, months: [{ month, remittancePaisa, expensePaisa, netPaisa, runningBalancePaisa }], latestMonthByCategory: [{ categoryId, nameBn, nameEn, totalPaisa }] }`. `runningBalancePaisa` is the cumulative `remittance − expense` across the window starting from zero (documented in the schema description).
2. Remittance = income with category key `remittance`; expense = all expenses. Both exclude other members' private entries.
3. Allowed for every role including viewer; the handler builds the response only from aggregates, so a type test asserts the DTO has no fields named `note`, `counterparty`, `trxId` or `transactions`.
**Tests** `viewer receives the report`; `running balance accumulates across months`; `latest month categories sum to that month's expense`; `private entries of others excluded`; `response keys contain no entry-level fields`; `range over 24 months returns 400`.
**Acceptance** `pnpm test:db --filter remittance && pnpm openapi:check`
**Done when** E6 renders from one request.

### T-REP-04 · CSV streaming and export placeholders
- **Closes:** FR-REP-04
- **Depends on:** T-REP-01, T-LED-05
- **Milestone:** M7 · **Layer:** api
**Why** — The CSV handler loads every row of up to 24 months into memory (`routes/reports.ts`).
**Files** C `app/export-csv.ts`, `http/export-routes.ts`; M `src/csv.ts` → `modules/reporting/domain/csv.ts` (with its tests).
**Steps**
1. `GET …/reports/export.csv?from=&to=&month=` stays `member+` with the same query rules and 24-month limit and the same header row (adding `Source` and `Split group` columns **at the end** so existing consumers keep working).
2. Stream: write the BOM, then the header, then rows in pages of 1,000 obtained from `ledger.listVisibleTransactions` ascending by `occurredAt` (cursor), pushing into a Node `Readable` passed to `reply.send`. Content type and `content-disposition` are unchanged. Cell escaping uses `csvCell` (formula injection guard) as today.
3. `GET …/reports/export.xlsx` and `…/export.pdf` are registered behind feature flag `export_office` (default off) and return `501 not_implemented` with `message: "Excel and PDF export arrive in phase 3"` (documented in OpenAPI, FR-REP-04 P3).
**Tests** `domain/csv.test.ts` (moved): `neutralises formulas`; `quotes commas and newlines`; `paisaToDecimal handles negatives`. DB: `csv for 5,000 rows streams without loading all rows` (assert page size via the facade spy); `csv has BOM and header`; `csv excludes other members' private entries`; `range over 24 months returns 400`; `xlsx returns 501 while the flag is off`.
**Acceptance** `pnpm test && pnpm test:db --filter export`
**Done when** memory stays flat for a 24-month export in the large-fixture test (`RSS growth < 50 MB`).

### T-REP-05 · Short-lived summary cache with event busting
- **Closes:** SRS §3.5 (ledger events → reporting), NFR-01
- **Depends on:** T-REP-01, T-LED-04
- **Milestone:** M7 · **Layer:** api
**Why** — Home and the summary screen request the same month repeatedly; recomputing four grouped queries each time is wasteful.
**Files** C `app/summary-cache.ts`, `app/on-ledger-changed.ts`.
**Steps**
1. In-process LRU (`Map`, max 500 entries, TTL 60 s) keyed `familyId:viewerKey:month` where `viewerKey` is the user id (private entries differ per viewer). `getMonthSummary` returns cached values and exposes `cacheHit` through the `X-Cache: hit|miss` header (test only).
2. Subscribe to `ledger.TransactionCreated/Updated/Deleted.v1` and `families.MemberRemoved.v1`: delete all keys for `familyId` and the affected month(s) (current and `before` month on updates).
3. Because the cache is per process, a multi-instance deployment may serve a value up to 60 seconds old; this is accepted and documented in the module README.
**Tests** `second request in 60 seconds is a hit`; `transaction created busts that month for every viewer`; `update with a month change busts both months`; `different viewers have separate entries`; `TTL expiry recomputes` (fake clock); `cache never exceeds 500 entries`.
**Acceptance** `pnpm test:db --filter summary-cache`
**Done when** AC-01 (both members see the same total within 5 s) still passes with the cache on.

---

# T-SYNC · sync (`apps/api/src/modules/sync`)

### T-SYNC-01 · Sync module through the ledger facade
- **Closes:** FR-SYNC-02, FR-SYNC-05, GAP-ARCH-01 (sync), SRS §9
- **Depends on:** T-LED-04
- **Milestone:** M4 · **Layer:** api
**Why** — `routes/sync.ts` reads and writes ledger tables directly and re-implements validation. It also never publishes ledger events, so budgets and chat would miss changes arriving from devices.
**Files** C `modules/sync/{index.ts,schema.ts,events.ts,jobs.ts}`, `http/sync-route.ts`, `app/sync.ts`; C in ledger `app/apply-remote-change.ts`, `app/list-changes.ts`; D `routes/sync.ts`.
**Steps**
1. Ledger facade: `applyRemoteChange(familyId, actor: { userId, role }, change: SyncTransaction): Promise<{ status: "applied" } | { status: "stale" } | { status: "rejected"; reason: "unknown_reference"|"duplicate_trx_id"|"forbidden"|"id_taken" }>` containing the logic now in the `db.transaction` block of `sync.ts` (existing-row checks, `winsOver`, edit permission, `bumpSyncSeq`, unique-violation mapping). It publishes `TransactionCreated` (new row), `TransactionUpdated` (existing live row) or `TransactionDeleted` (`deletedAt` set) **only when `applied`**.
2. Ledger facade: `listChangesSince(familyId, viewerUserId, cursorSeq, limit)` → `{ rows: SyncTransaction[]; lastSeq; more }` using `visibleTo` semantics for sync (tombstones included, other members' private rows excluded) and the existing `toWire` mapping, including optional `toAccountId` and `splitGroupId`.
3. Ledger facade: `checkClockDrift(hlcs: string[], nowMs): void` throwing `ClockDriftError`; the sync handler maps it to `400 clock_drift` as today.
4. `app/sync.ts` parses the body with `SyncRequestSchema`, validates each row with `SyncTransactionSchema` (invalid → `rejected: invalid`), calls `families.requireRole(familyId, userId, "member", { write: true })` (viewers get 403, matching the code and FR-FAM-05; SRS §4.3.1 text that viewers "receive changes" is superseded by FR-FAM-05, noted in the PR), pre-validates references with `ledger.assertRefs`-style set checks, then loops the facade call, and returns the same response shape (`cursor`, `more`, `applied`, `rejected`, `changes.transactions`).
5. Wire format, `PAGE = 500`, body limit 2 MB and error reasons stay identical so the shipped mobile `SyncService` keeps working.
**Tests** moved sync tests plus: `applied change publishes the matching event`; `stale change publishes nothing`; `rejected change publishes nothing`; `viewer is 403`; `private row of another user never appears in changes`; `clock drift returns 400 clock_drift`; `same push twice leaves one row and one event`; `savepoint isolation: one duplicate trx_id does not reject the rest`.
**Acceptance** `pnpm test:db --filter sync && pnpm arch && pnpm openapi:check`
**Done when** AC-24 server assertions (T-SYNC-04) and every old sync test pass unchanged.

### T-SYNC-02 · Reference-data bundle with ETag
- **Closes:** FR-SYNC-08, GAP-SYNC-01, F4
- **Depends on:** T-SYNC-01, T-BUD-01, T-FAM-09
- **Milestone:** M4 · **Layer:** api
**Why** — Offline screens need categories, accounts, budgets, members and limits. Today the app fetches categories and accounts by separate calls and has no budgets, members or entitlements locally.
**Files** C `app/reference-bundle.ts`, `http/reference-route.ts`; M `packages/shared/src/schemas.ts` (`ReferenceBundleSchema`).
**Steps**
1. `GET /v1/families/:id/sync/reference` (member+) → `{ etag, serverTime, categories: CategoryDto[] (including hidden), accounts: AccountDto[] (including archived, balances per T-LED-08 rules), budgets: { month, items: BudgetStatusDto[] } (current Dhaka month, effective incl. inherited), members: [{ userId, displayName, role }], entitlements: { memberLimit, aiQuotaMonth, features }, policy: { version } }`.
2. `etag` is `"W/" + sha256(stableStringify(payloadWithoutServerTime))` truncated to 32 hex chars, also sent as the `ETag` header; a matching `If-None-Match` returns `304` with no body (saves data, NFR-03).
3. Composed only from facades: `ledger.listCategories/listAccounts`, `budgeting.getBudgetStatus`, `families.listMembers`, `families.getFamilyLimits`, `identity.getPolicyVersion`.
4. Payload is small (≤ 20 KB for a 5-member family in the fixture; asserted).
**Tests** `bundle contains all sections`; `second request with If-None-Match returns 304`; `etag changes when a category is renamed`; `etag does not change between two requests`; `viewer is 403`; `payload under 20 KB for the demo family`; `budgets are the current month's effective budgets`.
**Acceptance** `pnpm test:db --filter reference-bundle && pnpm openapi:check`
**Done when** a fresh install can render B3, E1, E2 and B4 offline from this response alone (verified by the mobile task).

### T-SYNC-03 · Tombstone retention and cursor-too-old
- **Closes:** FR-TXN-03 (30-day tombstones), SRS §9
- **Depends on:** T-LED-07, T-SYNC-01
- **Milestone:** M4 · **Layer:** api
**Why** — If purge removes a tombstone before a long-offline device syncs, that device keeps a deleted row forever ("zombie").
**Files** M ledger `schema.ts` (`ledger.purge_marks(family_id uuid primary key, purged_through_seq bigint not null, at timestamptz)`), `jobs.ts`; M `http/sync-route.ts`, `packages/shared/src/schemas.ts` (`SyncResponse.snapshot`); C migration.
**Steps**
1. The purge job (T-LED-07) records, per family, `purged_through_seq = max(sync_seq)` of the rows it deleted.
2. Sync: when the request `cursor` is non-null and `cursor < purged_through_seq` → `409 cursor_too_old` with `details: { action: "full_resync" }`. Nothing is applied from that request.
3. Responses add `snapshot: boolean`: `true` for a request with `cursor = null` (a full download); the client may delete synced local rows that are absent from a **completed** snapshot (when `more` is false) and not pending locally. Contract documented in the OpenAPI description and mirrored in `T-MOB` sync tasks.
4. Devices offline longer than 30 days therefore always recover.
**Tests** `purge records purged_through_seq`; `old cursor after purge returns cursor_too_old`; `null cursor returns snapshot true and all live rows`; `fresh cursor is unaffected`; `snapshot flag false for incremental sync`.
**Acceptance** `pnpm test:db --filter cursor-too-old && pnpm openapi:check`
**Done when** the zombie scenario passes: device A deletes, purge runs, device B (cursor older than purge) gets `cursor_too_old`, then a snapshot without the row.

### T-SYNC-04 · Shared vectors and convergence tests
- **Closes:** FR-SYNC-02, AC-24 (server half), NFR-11
- **Depends on:** T-SYNC-01
- **Milestone:** M4 · **Layer:** api + shared
**Why** — Dart and TypeScript must agree on HLC ordering and on sync responses; the mobile contract test will read the same fixtures.
**Files** M `packages/shared/test-vectors/hlc.json`; C `packages/shared/test-vectors/api/sync.json`, `modules/sync/sync-convergence.db.test.ts`, `modules/ledger/domain/hlc.vectors.test.ts`.
**Steps**
1. Extend `hlc.json` with cases: counter overflow at `FFFF` rolls the time by 1 ms; drift exactly at the 24-hour limit is accepted and +1 ms is rejected; equal time and counter ordered by node id; parse failures for malformed strings. Each case lists the input and the expected output string.
2. `api/sync.json`: request/response pairs for first sync, incremental sync, tombstone, each rejection reason, `cursor_too_old`, `clock_drift`. The Dart and TypeScript tests both load it.
3. Convergence test: simulate three devices with different node ids that make conflicting edits to the same row in different orders, push in all 6 permutations, and assert the final server row equals the one with the greatest HLC; then pull on each device and assert identical data. Ties break by `nodeId`.
4. A property test (fast-check, 200 runs) generates random edit sequences and asserts "merge is commutative and idempotent".
**Tests** as above, named: `hlc vectors pass`; `three devices converge in every push order`; `equal hlc ties break by node id`; `merge is idempotent (property)`; `merge is commutative (property)`; `sync fixtures match the schema`.
**Acceptance** `pnpm test && pnpm test:db --filter sync-convergence && pnpm openapi:check`
**Done when** AC-24 server assertions pass and the fixture files exist for the mobile tests.

---

## Task index

| Area | Tasks | Count |
|---|---|---|
| T-ID | 01 skeleton · 02 OTP store · 03 SMS gateway · 04 OTP routes · 05 sessions · 06 logout · 07 profile · 08 consents · 09 devices · 10 erasure hook | 10 |
| T-FAM | 01 facade · 02 create family · 03 me/family/members · 04 invites · 05 invite delivery · 06 transfer · 07 orphan handling · 08 suspension · 09 limits + aggregates | 9 |
| T-LED | 01 schema move · 02 seed + icons · 03 visibility + facade · 04 use cases + events · 05 list + cursor · 06 get one · 07 restore + purge · 08 balances + transfers · 09 attachments · 10 splits · 11 merchant rules | 11 |
| T-BUD | 01 module + status words · 02 alert engine · 03 carry-forward · 04 festival split | 4 |
| T-REC | 01 module + skip · 02 reminders · 03 confirm via ledger | 3 |
| T-AI | 01 module + ports · 02 metering · 03 quota · 04 daily ceiling · 05 merchant rule step · 06 receipt split · 07 usage + staff facade | 7 |
| T-REP | 01 module + series · 02 trend · 03 remittances · 04 CSV stream · 05 cache | 5 |
| T-SYNC | 01 module · 02 reference bundle · 03 tombstones · 04 vectors + convergence | 4 |
| **Total** | | **53** |
