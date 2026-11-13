# Backend engagement modules: tasks

Areas: **T-NOTIF** (notifications), **T-COMM** (family communication), **T-SHOP** (bazaar list), **T-LEND** (dhar), **T-BILL** (plans and payments), **T-PRIV** (privacy), **T-ADM** (admin API).
Read first: [README](./README.md) (rules, template, commands) and [SRS v1.0](../SRS.md) §3 (modular monolith), §4.9, §4.12–4.17, §5.2, §5.4, §6, §8, §11, §12.3, §15.

## 0. How these tasks connect

### 0.1 Capabilities assumed from T-PLAT (referenced by capability, not by task number)
Every module receives a `ModuleContext` (`ctx`) in `registerModule(app, ctx)`:

| Capability | Shape used in this file |
|---|---|
| Config | `ctx.config.get("NAME")`, typed env |
| Clock / ids | `ctx.clock.now(): Date`, `ctx.ids.uuidv7(): string` (both injectable in tests) |
| Database | `ctx.db` (Drizzle), one `pgSchema` per module, `ctx.db.transaction(fn)` |
| Events | `ctx.events.publish(tx, name, payload)` (writes to `platform.outbox` in the same transaction), `ctx.events.subscribe(name, handlerId, handler)`; handlers idempotent by `event.id` |
| Jobs | `ctx.jobs.register(name, handler)`, `ctx.jobs.schedule(name, cron, tz)`, `ctx.jobs.enqueue(name, payload, {startAfter, singletonKey})` (pg-boss) |
| Rate limiter | `ctx.rateLimit.consume(key, limit, windowSeconds): {allowed, retryAfterSeconds}` (database-backed) |
| Storage | `ctx.storage.presignPut(key, {contentType, maxBytes, ttlSeconds})`, `presignGet(key, ttlSeconds)`, `head(key)`, `delete(key)`, `putObject(key, body)` |
| WebSocket hub | `ctx.hub.publishToUsers(userIds, frame)`, `ctx.hub.isOnline(userId)`, `ctx.hub.onlineUserIds()`, `ctx.hub.onFrame(type, handler)` where `handler(session, frame)`, `ctx.hub.onConnect(fn)`, `ctx.hub.onDisconnect(fn)`, `session = {userId, deviceId, familyId, ip}` |
| Feature flags | `ctx.flags.isOn("comms.video")` |
| Auth guard | `app.authenticate` (family users), `requireFamilyRole` via `families` facade |
| Fakes | `tools/fakes`: fake FCM sink, fake SMS, MinIO container, fake payment gateway server |

### 0.2 Facades of other modules these tasks call (interfaces only; owners are in `02-backend-core.md`)
| Facade function | Owner | Used by |
|---|---|---|
| `families.getMemberRole(familyId, userId): Role \| null` | families | all |
| `families.listMembers(familyId): {userId, role, displayName}[]` | families | comms, notifications, shopping |
| `families.isSuspended(familyId): boolean` | families | comms (guard), shopping, lending |
| `families.getFamilySummary(familyId)` and `families.listFamiliesForAdmin(filter)` (`@staff-safe`) | families | admin |
| `identity.listPushTargets(userIds): {userId, deviceId, platform, fcmToken, locale}[]` | identity | notifications |
| `identity.removeDeviceToken(fcmToken)` | identity | notifications |
| `identity.getProfile(userId): {name, locale, numeralStyle, simpleMode}` | identity | notifications, comms |
| `ledger.findCategoryByKey(familyId, key)` | ledger | shopping |
| `ledger.exportUserData(userId)` / `ledger.anonymiseUser(userId)` | ledger | privacy |
| `ai.getUsageSummary(familyId, month)` and `ai.getCostSummary(month)` (`@staff-safe`) | ai | admin |
| `budgeting` publishes `budgeting.BudgetThresholdCrossed.v1` | budgeting | notifications, comms |
| `recurring` publishes `recurring.BillDue.v1` | recurring | notifications |
| `families` publishes `families.InviteCreated.v1 {inviteId, familyId, invitedPhone?, invitedUserId?, token, role, createdBy, expiresAt}` | families | notifications |

If an owner task is not finished when a task here starts, the task here codes against the interface and uses the fake listed in its **Tests** section; the interface file lives in `apps/api/src/modules/<owner>/index.ts` (stub exports that throw `NotImplemented` are created by the first task that needs them).

### 0.3 Dependency graph and parallelism

```
T-NOTIF-01 ─┬─ T-NOTIF-02 ─┐
            ├─ T-NOTIF-03 ─┤
            └─ T-NOTIF-04 ─┴─ T-NOTIF-05 ─┬─ T-NOTIF-06
                                          ├─ T-NOTIF-07
                                          └─ T-NOTIF-08
T-COMM-01 ─ T-COMM-02 ─┬─ T-COMM-03 ─ T-COMM-04 ─ T-COMM-05 ─┬─ T-COMM-06
                       │                                     ├─ T-COMM-07
                       ├─ T-COMM-08 ─ T-COMM-09 ─ T-COMM-10 ─ T-COMM-11
                       ├─ T-COMM-12
                       ├─ T-COMM-13 ─ T-COMM-14 ─ T-COMM-15
                       └─ T-COMM-16 ─ T-COMM-17 ─ T-COMM-18 ─ T-COMM-19 (P3)
T-COMM-20 (guards, hooks) after T-COMM-05, T-PRIV-02
T-SHOP-01 ─ T-SHOP-02 ─ T-SHOP-03          T-LEND-01 ─ T-LEND-02 ─ T-LEND-03
T-BILL-01 ─ T-BILL-02 ─ T-BILL-03 ─ T-BILL-04 ─ T-BILL-05 ─ T-BILL-06 ─ T-BILL-07 ─ T-BILL-08
T-PRIV-01 ─ T-PRIV-02 ─ T-PRIV-03 ─ T-PRIV-04 ─ T-PRIV-05 ─ T-PRIV-06 ─ T-PRIV-07
T-ADM-01 ─ T-ADM-02 ─ T-ADM-03 ─ T-ADM-04 ─ T-ADM-05 ─┬─ T-ADM-06 ─ T-ADM-07 ─ T-ADM-08
                                                       ├─ T-ADM-09
                                                       ├─ T-ADM-10
                                                       ├─ T-ADM-11
                                                       └─ T-ADM-12 ─ T-ADM-13
```

**Parallel lanes** once the platform capabilities exist: (1) NOTIF 01–05 → COMM 09–11; (2) COMM 01–07 (chat); (3) COMM 13–15 (media); (4) SHOP, LEND, BILL independent of each other; (5) PRIV 01–03 and ADM 01–04 independent; (6) ADM 06+ needs `@staff-safe` facades from other areas (T-ADM-05 defines the contract; the owners add the facades in their own tasks or in T-ADM-05's stubs).
**Milestones**: NOTIF 01–06 → M1; NOTIF 07–08, COMM 01–15, COMM 20 → M3; PRIV and ADM → M5; COMM 16–18 → M6; SHOP → M7; BILL, LEND → M8 (T-BILL-02 entitlements facade is needed from M2 for `ai` quota and member limits, so it ships early with default Free limits).

### 0.4 Conventions used below
- Paths are relative to `apps/api/src/modules/<module>/`. A task that says "tests in `comms/…`" means `apps/api/src/modules/comms/…`.
- Test files named `*.test.ts` run under `pnpm test` (pure, no DB); files named `*.db.test.ts` run under `pnpm test:db` (real PostgreSQL, MinIO, fakes).
- Every new route is declared with Zod schemas from `packages/shared/src/schemas/<module>.ts` so OpenAPI is generated (`pnpm openapi:check` must stay green).
- Every new family-scoped route calls `families.getMemberRole`; non-members get 404; suspended families get `423 family_suspended` on writes (guard from T-COMM-20 / T-FAM).
- Error body is always `{ "error": { "code": "...", "message": "...", "details"?: {...} } }`.
- Bangla messages in error `message` are English; the app maps `code` to Bangla copy.
- All timestamps in JSON are ISO-8601 UTC strings. All ids are UUID strings (v7 for messages, nudges, events, media).

---

# T-NOTIF: Notifications

Goal: one place that decides **whether, where and how** a user is notified (WebSocket, FCM, inbox), and owns the inbox, preferences, reminders and templates. Other modules never call FCM; they publish events or call `notifications.notify()`.

### T-NOTIF-01 · Module scaffold, schema and facade
- **Closes:** FR-NOT-01, FR-NOTIF-04, FR-NOTIF-05, GAP-NOT-01
- **Depends on:** platform module skeleton (generator, migrations)
- **Milestone:** M1 · **Layer:** api
**Why** — The inbox and preferences need a home before anything can notify. This task creates the module and tables only.
**Files**
- C `notifications/index.ts` (facade: exports types `NotifyInput`, `InboxItemDto`, `Preferences`; functions `notify`, `getPreferences`, `isQuietNow` — implemented in later tasks; stubs throw `NotImplemented`).
- C `notifications/schema.ts`, `notifications/events.ts` (empty event list for now), `notifications/jobs.ts` (empty), `notifications/http/routes.ts` (empty plugin), `notifications/domain/`, `notifications/app/`, `notifications/infra/`.
- M `apps/api/src/app.ts` (register module after `identity`, `families`).
- C migration `apps/api/drizzle/00NN_notifications_init.sql` (generated by `pnpm db:generate`).
- C `packages/shared/src/schemas/notifications.ts` (placeholders exported in T-NOTIF-03/06).
**Steps**
1. Run `pnpm gen:module notifications`; confirm it creates the folder set above and the architecture test still passes.
2. In `schema.ts` declare `export const notificationsSchema = pgSchema("notifications")` and tables:
   - `inbox_items`: `id uuid pk`, `user_id uuid not null`, `family_id uuid null`, `kind text not null` (check in list: `budget_threshold`, `invite`, `daily_reminder`, `bill_due`, `nudge`, `message`, `call_missed`, `call_incoming`, `dhar_due`, `export_ready`, `erasure_scheduled`, `plan_changed`, `system`), `title text not null`, `body text not null`, `speech_text text not null`, `data jsonb not null default '{}'`, `dedupe_key text null`, `created_at timestamptz not null default now()`, `read_at timestamptz null`, `seq bigint generated always as identity` (used by polling fallback).
   - Indexes: `(user_id, created_at desc)`, `(user_id, seq)`, unique `(user_id, dedupe_key) where dedupe_key is not null`.
   - `preferences`: `user_id uuid pk`, `kinds jsonb not null default '{}'` (map kind → boolean, missing = true), `quiet_start time not null default '22:00'`, `quiet_end time not null default '06:00'`, `daily_reminder_time time not null default '21:00'`, `daily_reminder_enabled boolean not null default true`, `hide_presence boolean not null default false`, `updated_at timestamptz not null default now()`.
3. No foreign keys to other schemas (DEC-02). Add a comment line above each `user_id` column: `-- identity.users.id, integrity via UserErased handler`.
4. Generate and commit the migration; run `pnpm db:migrate` against the test database.
**Contract** — Tables as above. Facade signatures:
```ts
export type NotifyInput = {
  userIds: string[]; familyId?: string; kind: InboxKind;
  params: Record<string, string | number>; // template parameters
  data?: Record<string, unknown>; dedupeKey?: string;
  push?: { priority: "high" | "normal"; channel: "nudge" | "chat" | "alerts" | "reminders" | "calls" };
  skipInbox?: boolean;
};
export function notify(ctx, input: NotifyInput): Promise<{ delivered: Record<string, "socket" | "push" | "inbox_only"> }>;
```
**Tests** — `notifications/schema.db.test.ts`: `creates tables`, `dedupe key unique per user`, `read_at defaults null`; `architecture.test.ts` still green.
**Acceptance** — `pnpm db:migrate && pnpm test:db -- notifications/schema && pnpm arch` exit 0.
**Done when** — the module exists, is registered, its tables exist in a fresh database, and boundary rules pass.

### T-NOTIF-02 · PushSender port, FCM adapter and fake sink
- **Closes:** FR-NOT-01, FR-NOTIF-06, FR-NOTIF-07, DEC-06
- **Depends on:** T-NOTIF-01
- **Milestone:** M1 · **Layer:** api
**Why** — Push must be testable without Google and must send **data** messages (not notification-only) so the app controls vibration.
**Files**
- C `notifications/infra/push-sender.ts` (interface and result types).
- C `notifications/infra/fcm-sender.ts` (production adapter using `firebase-admin` `messaging().sendEach`).
- C `notifications/infra/fake-sender.ts` (in-memory sink with an inspection API).
- C `notifications/http/test-sink-routes.ts` (only when `PUSH_DRIVER=fake`: `GET /test/push-sink`, `DELETE /test/push-sink`).
- M `apps/api/package.json` (add `firebase-admin`).
- M `apps/api/src/platform/config.ts` (env: `PUSH_DRIVER=fcm|fake` default `fake` outside production, `FCM_CREDENTIALS_JSON` base64 service-account JSON required when `fcm`).
- C `tools/fakes/push-sink-client.ts` (helper used by e2e tests).
**Steps**
1. Define:
```ts
export type PushMessage = {
  token: string; deviceId: string;
  priority: "high" | "normal";
  ttlSeconds: number;           // nudge 60, message 3600, call 45, reminder 86400
  collapseKey?: string;
  data: Record<string, string>; // all values strings; always includes {kind, v:"1"}
  androidChannelId?: "nudge" | "chat" | "alerts" | "reminders" | "calls";
};
export type PushResult = { token: string; ok: boolean; error?: "UNREGISTERED" | "INVALID_ARGUMENT" | "QUOTA" | "UNAVAILABLE" | "OTHER" };
export interface PushSender { send(messages: PushMessage[]): Promise<PushResult[]> }
```
2. FCM adapter maps to `{ token, data, android: { priority: "HIGH"|"NORMAL", ttl: ttlSeconds*1000, collapseKey, directBootOk: true } }` (no `notification` block). Batches of up to 500 with `sendEach`. Maps FCM error codes `messaging/registration-token-not-registered` and `messaging/invalid-registration-token` to `UNREGISTERED`; `messaging/message-rate-exceeded` to `QUOTA`; `messaging/server-unavailable` to `UNAVAILABLE`.
3. Retry policy inside the adapter: only `UNAVAILABLE` and `QUOTA`, 3 attempts, delays 1 s, 3 s, 9 s with ±20% jitter, honouring `Retry-After`.
4. Fake sender stores every message with `sentAt`, supports `await sink.waitFor(predicate, timeoutMs)`, and can be told to fail a token (`sink.failToken(token, "UNREGISTERED")`) for cleanup tests.
5. Wire the adapter by `PUSH_DRIVER` in `notifications/index.ts` `registerModule` (inject into `app/notifier.ts` later).
**Contract** — `data` keys are defined per kind in T-NOTIF-04; `v` is the payload version string `"1"`.
**Tests** — `notifications/infra/fcm-sender.test.ts` (mock `firebase-admin`): `maps UNREGISTERED`, `retries UNAVAILABLE three times`, `never sets notification block`, `batches 500`; `fake-sender.test.ts`: `waitFor resolves`, `failToken works`.
**Acceptance** — `pnpm test -- notifications/infra && pnpm typecheck`; `PUSH_DRIVER=fake pnpm --filter api dev` then `curl -s localhost:4000/test/push-sink` returns `[]`.
**Done when** — the port, real adapter and fake exist, are selected by env, and no code outside `infra/` imports `firebase-admin`.

### T-NOTIF-03 · Preferences and quiet hours
- **Closes:** FR-NOTIF-05, FR-NUDGE-06 (domain part)
- **Depends on:** T-NOTIF-01
- **Milestone:** M1 · **Layer:** api
**Why** — Quiet hours decide whether a phone vibrates; the rule must be one pure function that comms, reminders and the app all agree on.
**Files**
- C `notifications/domain/quiet-hours.ts` and `quiet-hours.test.ts`.
- C `notifications/app/preferences.ts`, `notifications/http/preferences-routes.ts`.
- M `notifications/index.ts` (implement `getPreferences`, `isQuietNow`).
- M `packages/shared/src/schemas/notifications.ts` (`NotificationPreferencesSchema`, `UpdateNotificationPreferencesSchema`).
**Steps**
1. `isQuietAt(now: Date, quietStart: "HH:mm", quietEnd: "HH:mm", tz = "Asia/Dhaka"): boolean`. Convert `now` to Dhaka local time; if `start < end` quiet when `start <= t < end`; if `start > end` (overnight, default 22:00–06:00) quiet when `t >= start || t < end`; if equal → never quiet.
2. `getPreferences(userId)` returns defaults when no row exists (no row creation on read).
3. `PUT /v1/me/notification-preferences` validates body, upserts, returns the full object. Quiet times must be `HH:mm`; reminder time must be `HH:mm`.
4. `GET /v1/me/notification-preferences` returns the same shape.
5. Facade `isQuietNow(userId): Promise<boolean>` reads prefs and the injected clock.
**Contract**
```json
// GET/PUT /v1/me/notification-preferences
{ "kinds": { "budget_threshold": true, "nudge": true, "message": true, "daily_reminder": true, "bill_due": true, "call_missed": true },
  "quietStart": "22:00", "quietEnd": "06:00",
  "dailyReminderTime": "21:00", "dailyReminderEnabled": true, "hidePresence": false }
```
Errors: `invalid_request` (400) for bad time strings.
**Tests** — `quiet-hours.test.ts`: `overnight window quiet at 23:00`, `quiet at 05:59`, `not quiet at 06:00`, `same-day window`, `start equals end never quiet`, `uses Asia/Dhaka across UTC midnight`. `preferences.db.test.ts`: `defaults without row`, `upsert`, `rejects 25:00`, `other users cannot read mine`.
**Acceptance** — `pnpm test -- quiet-hours && pnpm test:db -- notifications/preferences`.
**Done when** — preferences round-trip and the quiet-hours function passes all boundary cases.

### T-NOTIF-04 · Templates and speech text (Bangla and English)
- **Closes:** FR-NOTIF-04 (listen), FR-VOICE-05 reuse, FR-NOT-01
- **Depends on:** T-NOTIF-01
- **Milestone:** M1 · **Layer:** api
**Why** — Every notification needs a title, a body and a speakable version with amounts in words, in the recipient's language.
**Files**
- C `notifications/domain/templates.ts` and `templates.test.ts`.
- C `notifications/domain/push-data.ts` (per-kind `data` payload builders).
- M `packages/shared/src/index.ts` (already exports `amountToBanglaWords` from `words.ts`; reuse it, do not duplicate).
**Steps**
1. `render(kind, locale, params): {title, body, speech}` for the kinds in T-NOTIF-01. Amount params are paisa integers; the renderer formats `body` with `formatMoney` (Bangla or Latin numerals by user setting; pass `numeralStyle`) and `speech` with `amountToBanglaWords` in Bangla (English speech uses plain digits).
2. Bangla copy (exact strings used by tests):
   - `budget_threshold` 80: title `বাজেট ৮০% শেষ`, body `{category}-এর বাজেটের ৮০% খরচ হয়ে গেছে।`, speech `{category}-এর বাজেটের আশি শতাংশ খরচ হয়ে গেছে।` — wording uses "শতাংশ" only in speech; the screen uses `৮০%`.
   - `budget_threshold` 100: title `বাজেট শেষ`, body `{category}-এর বাজেট শেষ। ৳ {over} বেশি খরচ হয়েছে।`, speech with `{overWords} টাকা`.
   - `invite`: title `পরিবারে আমন্ত্রণ`, body `{inviter} আপনাকে {family}-এ ডেকেছেন।`
   - `daily_reminder`: title `আজকের খরচ লিখেছেন?`, body `দিন শেষ হয়ে এল। আজকের খরচ লিখে রাখুন।`
   - `bill_due`: title `বিল দেওয়ার সময়`, body `{name} {days} দিন পর। ৳ {amount}।` (when `days=0`: `আজ`)
   - `nudge`: title `{sender}`, body `{phrase}`, speech `{sender} বলছেন: {phrase}`.
   - `message`: title `{sender}`, body = first 80 chars of text, or `ভয়েস মেসেজ` / `ভিডিও মেসেজ`.
   - `call_missed`: title `মিস কল`, body `{sender} আপনাকে ভিডিও কল করেছিলেন।`
   - `dhar_due`, `export_ready`, `erasure_scheduled`, `plan_changed`, `system`: write fixed Bangla and English strings in the same file; each ≤ 120 characters.
3. English equivalents for every key; a test asserts every Bangla key has an English key and vice versa.
4. `push-data.ts`: `buildPushData(kind, params, data)` returns the string map; required keys: `kind`, `v`, `inboxId` (set later), `familyId?`, plus kind-specific: nudge → `nudgeId, senderId, senderName, phraseId, phrase, intensity, quiet` (`"1"|"0"`), message → `conversationId, messageId, preview`, call → `callId, callerId, callerName, startedAt`, budget → `budgetId, threshold`, etc. Values over 3,000 bytes in total are rejected with an error (FCM limit 4 KB).
**Contract** — As above.
**Tests** — `templates.test.ts`: `every kind has bn and en`, `bn speech contains amount in words (৳ ১,২৫,০০০ → এক লাখ পঁচিশ হাজার টাকা)`, `title ≤ 40 chars`, `body ≤ 120 chars except message preview 80`, `numeral style latin vs bangla`; `push-data.test.ts`: `all values are strings`, `payload under 3000 bytes`, `nudge payload carries quiet flag`.
**Acceptance** — `pnpm test -- notifications/domain`.
**Done when** — all kinds render in both languages with speech text and valid push payloads.

### T-NOTIF-05 · `notify()` delivery rule (socket first, then push, always inbox)
- **Closes:** FR-NOTIF-07, FR-NOT-01, NFR-17
- **Depends on:** T-NOTIF-02, T-NOTIF-03, T-NOTIF-04 and the WebSocket hub capability
- **Milestone:** M1 · **Layer:** api
**Why** — The rule "socket if connected, else FCM, inbox always" must live in one function so every module behaves the same.
**Files**
- C `notifications/app/notifier.ts`, `notifications/app/notifier.db.test.ts`.
- M `notifications/index.ts` (export `notify`).
- C `notifications/app/token-cleanup.ts`.
**Steps**
1. `notify(ctx, input)`:
   1. Load users' profiles (`identity.getProfile`) and preferences. Skip users whose preference for `input.kind` is `false` (still insert an inbox row unless `skipInbox`; kind-off means no push, no socket frame; inbox row is still written so the user can see it later; document this in code comment).
   2. For each user render the template in their locale and numeral style; build `data`.
   3. Unless `skipInbox`, insert `inbox_items` (use `dedupe_key` with `on conflict do nothing`; if the row already exists, skip delivery entirely for that user — this makes events idempotent).
   4. Decide the channel: `ctx.hub.isOnline(userId)` → publish frame `{t:"inbox", id, item}` (and for `kind` nudge/message the specific frames are sent by comms; notify only sends the `inbox` frame); result `"socket"`. Else load push targets (`identity.listPushTargets`) → build `PushMessage` per device with priority and channel from `input.push`; send; result `"push"`. If no targets → `"inbox_only"`.
   5. Quiet hours: if `isQuietNow(userId)` and kind in `{nudge, message, daily_reminder, bill_due}`, set `data.quiet = "1"` and use `priority "normal"` and channel `alerts` for push so the OS does not vibrate; the app still shows the item. Calls (`calls` channel) ignore quiet hours only when `input.push.priority = "high"` and kind `call_incoming` (defined in T-COMM-18).
2. Push results: for every `UNREGISTERED` token call `identity.removeDeviceToken(token)`; for `QUOTA`/`UNAVAILABLE` after retries, enqueue job `notifications.retry-push` once with `startAfter 60 s` and `singletonKey = inboxId+deviceId` (max 1 retry).
3. Increment counters in a small table `notifications.delivery_stats(day date, channel text, kind text, ok int, failed int)` upserted per call (read by T-ADM-12).
4. Return `delivered` map.
**Contract** — `data.inboxId` is added to every push so tapping it can mark the item read.
**Tests** — `notifier.db.test.ts`: `connected user gets socket frame and no push`, `offline user gets push in fake sink with data only`, `inbox row written in both cases`, `dedupeKey prevents second delivery`, `preference off writes inbox only`, `UNREGISTERED token removed via identity fake`, `quiet hours downgrade priority and set quiet=1`, `no targets gives inbox_only`, `delivery_stats counted`.
**Acceptance** — `pnpm test:db -- notifications/app/notifier` exit 0; coverage of `notifications/app` ≥ 80%.
**Done when** — calling `notify` from a test produces the documented behaviour for the three recipient states.

### T-NOTIF-06 · Inbox endpoints and polling fallback
- **Closes:** FR-NOTIF-04, FR-NOTIF-08, screen F3
- **Depends on:** T-NOTIF-05
- **Milestone:** M1 · **Layer:** api
**Why** — The notification screen needs list, read, clear and a cheap polling endpoint for phones without push.
**Files**
- C `notifications/http/inbox-routes.ts`, `notifications/app/inbox.ts`, `notifications/app/inbox.db.test.ts`.
- M `packages/shared/src/schemas/notifications.ts` (`InboxItemSchema`, `InboxListSchema`).
**Steps**
1. `GET /v1/inbox?cursor=&limit=` (limit 1–50, default 30), newest first, cursor = base64 of `(created_at, id)`. Response `{ items: InboxItem[], nextCursor: string | null, unread: number }`.
2. `POST /v1/inbox/read` body `{ ids?: string[], all?: boolean }` marks read (`read_at = now()`), returns `{ updated: n }`. Exactly one of `ids` or `all` must be present (`invalid_request` otherwise).
3. `DELETE /v1/inbox` deletes the caller's items; `DELETE /v1/inbox/:id` deletes one. Returns 204.
4. `GET /v1/inbox/changes?afterSeq=<n>&limit=` returns `{ items, lastSeq }` ordered by `seq` ascending for the polling fallback (FR-NOTIF-08). `afterSeq` omitted means last 20.
5. Every query filters by `user_id = req.user.sub`.
**Contract**
```json
// InboxItem
{ "id":"…", "kind":"budget_threshold", "title":"বাজেট ৮০% শেষ", "body":"…", "speechText":"…",
  "data":{ "familyId":"…", "budgetId":"…", "threshold":80, "suggestNudge":{"phraseId":"budget_over"} },
  "createdAt":"…", "readAt":null, "seq":1042 }
```
Errors: 404 `not_found` for another user's id on delete.
**Tests** — `inbox.db.test.ts`: `paginates 3 pages stable order`, `mark read by ids`, `mark all`, `delete own only`, `changes returns after seq`, `unread count`, `cannot see another user's items`.
**Acceptance** — `pnpm test:db -- notifications/app/inbox && pnpm openapi:check`.
**Done when** — all four routes work and appear in `openapi.json`.

### T-NOTIF-07 · Event handlers: budget, bills, invites, plan, erasure notices
- **Closes:** FR-BUD-02, FR-NOT-01, FR-NOT-03, FR-FAM-06, GAP-FAM-02
- **Depends on:** T-NOTIF-05, T-NOTIF-06 and events defined by budgeting, recurring, families, billing, privacy owners
- **Milestone:** M3 · **Layer:** api
**Why** — Modules publish facts; notifications turns them into messages without any module importing it.
**Files**
- C `notifications/app/handlers.ts` and `handlers.db.test.ts`; M `notifications/index.ts` (`registerModule` subscribes).
- C `notifications/events.ts` (types for events this module consumes, re-exported from publishers' `events.ts` by type import only).
**Steps**
1. Subscribe (handler ids in brackets):
   - `budgeting.BudgetThresholdCrossed.v1` `{familyId, budgetId, categoryId?, categoryName, threshold: 80|100, spentPaisa, limitPaisa, month}` [`notif.budget`] → recipients = Owner/Admins (`families.listMembers` filtered), plus all members if the budget event has `notifyAll`; `kind budget_threshold`; `dedupeKey = "budget:"+budgetId+":"+month+":"+threshold`; `data.suggestNudge = {phraseId:"budget_over", recipients: adminIds}` (used by the app, FR-BUD-06); push channel `alerts`, priority normal.
   - `recurring.BillDue.v1` `{familyId, templateId, name, amountPaisa, dueOn, daysBefore}` [`notif.bill`] → all members who are Owner/Admin; `dedupeKey = "bill:"+templateId+":"+dueOn+":"+daysBefore`; channel `reminders`.
   - `families.InviteCreated.v1` [`notif.invite`] → if `invitedUserId` known (an existing account with that phone): notify them with kind `invite`, `data {token, familyId, role}`, channel `alerts`, priority high, `dedupeKey "invite:"+inviteId`. If no account exists: call `SmsGateway.send` through `identity.sendInviteSms(phone, link)` (identity facade; this handler does not talk to the SMS vendor).
   - `billing.SubscriptionChanged.v1` [`notif.plan`] → Owner only, kind `plan_changed`.
   - `privacy.ErasureRequested.v1` and `privacy.ExportReady.v1` [`notif.privacy`] → the user, kinds `erasure_scheduled` / `export_ready` (data includes the 7-day link for export).
   - `lending.DharDue.v1` [`notif.dhar`] → creator only.
2. Handlers load names via facades only (`families.getFamilySummary`, `identity.getProfile`).
3. Handlers never throw for missing users; they log `warn` and return (so the outbox does not retry forever).
**Contract** — Event payload types are TypeScript types imported from each publisher's `events.ts`; contract tests validate with Zod parsers exported by the publishers.
**Tests** — `handlers.db.test.ts`: `budget 80 notifies admins once even if event replays`, `members without admin role not notified`, `bill due uses days wording`, `invite to existing user creates inbox and push`, `invite to unknown phone calls sms fake`, `privacy export ready includes link in data`, `missing user does not throw`.
**Acceptance** — `pnpm test:db -- notifications/app/handlers`.
**Done when** — publishing each event in a test produces the expected inbox rows and fake push messages.

### T-NOTIF-08 · Reminder jobs (daily log reminder, bill reminders)
- **Closes:** FR-NOT-02, FR-NOT-03, FR-REC-03
- **Depends on:** T-NOTIF-05, T-NOTIF-03
- **Milestone:** M3 · **Layer:** api
**Why** — Habit reminders drive retention (BRD BO-4). They must respect each user's time, skip people who already logged today, and never double-send.
**Files**
- C `notifications/jobs.ts`, `notifications/app/daily-reminder.ts`, `daily-reminder.db.test.ts`.
- C `notifications/app/bill-reminders.ts` (consumes `recurring.listDueReminders(date)` facade, owner: T-REC).
**Steps**
1. Register job `notifications.daily-reminder-sweep` scheduled every 5 minutes (`*/5 * * * *`, tz `UTC`; the sweep converts to Dhaka). Each run: find users with `daily_reminder_enabled` whose `daily_reminder_time` falls in `(lastRun, now]` in Dhaka time (store `last_run_at` in `platform` KV or in a one-row table `notifications.job_state(name pk, last_run_at)`), excluding users who:
   - have `kinds.daily_reminder = false`; or
   - are in quiet hours at that moment **unless** the reminder time itself is outside quiet hours (the default 21:00 is allowed);
   - already created a transaction today in any family: call `ledger.hasLoggedToday(userId, dhakaDate): boolean` (facade; if not available yet, the handler imports a stub returning false and a TODO task id T-LED).
2. For each remaining user call `notify` kind `daily_reminder`, `dedupeKey = "daily:"+userId+":"+dhakaDate`, channel `reminders`.
3. Register `notifications.bill-reminder-sweep` daily at `09:00` Asia/Dhaka (`0 3 * * *` UTC): call `recurring.listDueReminders(dhakaDate)` returning `{familyId, templateId, name, amountPaisa, dueOn, daysBefore}[]`, publish nothing (the `recurring` module owns `BillDue`); this sweep only exists as a safety net: if `recurring` did not publish `BillDue` for a due reminder (checked by `dedupeKey` absence) it calls `notify` directly.
4. Use `ctx.jobs.enqueue` with `singletonKey` equal to the dedupe key so overlapping runs are harmless.
**Contract** — Job names above; both read the injected clock.
**Tests** — `daily-reminder.db.test.ts` with fake clock: `sends at 21:00 Dhaka`, `custom time 20:30`, `skips if logged today`, `skips if disabled`, `skips if kind off`, `second run same day sends nothing`, `time inside quiet hours still sends if user chose it`, `runs missed window after downtime within 2 hours only`.
**Acceptance** — `pnpm test:db -- notifications/app/daily-reminder`.
**Done when** — advancing the fake clock across 21:00 produces exactly one reminder per eligible user.

---

# T-COMM: Family communication

Goal: buzz (vibration nudge), text chat, voice notes, video messages, video calls and presence, inside the `comms` module. Screens: Main, `2`, `3`/Chat, `4`, `5`, `6`, F1, F2, B4. Design rules: SRS §4.12 and §8.

### T-COMM-01 · Schema and migration
- **Closes:** FR-CHAT-01, FR-NUDGE-01, FR-VNOTE-02, FR-VIDEO-07, GAP-COMM-01
- **Depends on:** platform module skeleton
- **Milestone:** M3 · **Layer:** api
**Why** — All later tasks need the tables.
**Files** — C `comms/schema.ts`; C migration `apps/api/drizzle/00NN_comms_init.sql`; C `comms/schema.db.test.ts`.
**Steps** — In `pgSchema("comms")` create (no cross-schema FKs; ids of users/families are plain `uuid`):
1. `conversations(id uuid pk, family_id uuid not null, kind text not null check in ('group','direct'), direct_key text null, title text null, created_at timestamptz default now())`; unique `(family_id, kind) where kind='group'`; unique `(family_id, direct_key) where direct_key is not null` (`direct_key` = the two user ids sorted and joined with `:`).
2. `conversation_members(conversation_id uuid, user_id uuid, joined_at timestamptz default now(), left_at timestamptz null, last_read_message_id uuid null, primary key (conversation_id, user_id))`; index `(user_id)`.
3. `messages(id uuid pk, conversation_id uuid not null, client_id uuid not null, sender_id uuid null, kind text not null check in ('text','voice','video','system'), body text null, media_id uuid null, meta jsonb not null default '{}', created_at timestamptz not null default now(), deleted_at timestamptz null)`; unique `(conversation_id, client_id)`; index `(conversation_id, id desc)`; check `kind='text' → body is not null and length(body) ≤ 2000`.
4. `media(id uuid pk, family_id uuid not null, kind text check in ('voice','video','video_thumb'), storage_key text not null, content_type text not null, bytes bigint not null, duration_ms int null, owner_id uuid not null, status text not null check in ('pending','ready','deleted') default 'pending', created_at timestamptz default now(), expires_at timestamptz not null)`; index `(status, expires_at)`.
5. `nudge_phrases(id text pk, text_bn text not null, text_en text not null, sort int not null, active boolean default true)`.
6. `nudges(id uuid pk, family_id uuid not null, sender_id uuid not null, recipient_id uuid not null, phrase_id text not null, intensity text not null check in ('soft','medium','strong'), state text not null check in ('sent','delivered','seen','replied') default 'sent', reply text null check in ('coming','later','call'), source text not null default 'manual', source_ref text null, created_at timestamptz default now(), delivered_at timestamptz null, seen_at timestamptz null, replied_at timestamptz null)`; indexes `(recipient_id, created_at desc)`, `(sender_id, recipient_id, created_at desc)` (rate-limit queries).
7. `call_sessions(id uuid pk, family_id uuid not null, initiator_id uuid not null, mode text not null default 'video', started_at timestamptz default now(), answered_at timestamptz null, ended_at timestamptz null, outcome text null check in ('completed','missed','declined','busy','failed','cancelled'))`; `call_participants(call_id uuid, user_id uuid, state text not null check in ('invited','ringing','joined','declined','missed','left'), joined_at timestamptz null, left_at timestamptz null, primary key (call_id, user_id))`; index `call_participants(user_id, state)`.
8. `presence_prefs` is **not** a table here: `hide_presence` lives in `notifications.preferences` (T-NOTIF-01) and is read through the `notifications.getPreferences` facade.
**Contract** — DDL as above; ids for messages, nudges, calls and media are UUID v7.
**Tests** — `schema.db.test.ts`: `unique client id per conversation`, `one group conversation per family`, `direct key unique`, `text length check rejects 2001 chars`, `nudge state check`.
**Acceptance** — `pnpm db:generate && git diff --exit-code apps/api/drizzle && pnpm db:migrate && pnpm test:db -- comms/schema`.
**Done when** — migration applies cleanly to an empty database and checks fire.

### T-COMM-02 · Module scaffold, WebSocket wiring and facade
- **Closes:** FR-NUDGE-02, FR-CHAT-02, GAP-ARCH-04 (comms part), NFR-17
- **Depends on:** T-COMM-01 and the WebSocket hub capability
- **Milestone:** M3 · **Layer:** api
**Why** — The hub is generic; comms must register its frames, enforce authorisation on every frame and expose a facade.
**Files** — C `comms/index.ts`, `comms/events.ts`, `comms/http/routes.ts`, `comms/app/ws-handlers.ts`, `comms/app/authz.ts`, `comms/app/ws-handlers.db.test.ts`; M `app.ts` (register after `families`, `notifications`).
**Steps**
1. `comms/events.ts` declares event types (Zod + TS): `comms.NudgeSent.v1 {nudgeId, familyId, senderId, recipientId, phraseId, intensity, createdAt}`, `comms.NudgeStateChanged.v1 {nudgeId, state, reply?}`, `comms.MessageSent.v1 {messageId, conversationId, familyId, senderId, kind, preview, createdAt}`, `comms.CallInvited.v1 {callId, familyId, initiatorId, recipientIds}`, `comms.CallEnded.v1 {callId, familyId, outcome, durationSec}`.
2. `authz.ts`: `assertConversationMember(conversationId, userId)` (404 if not a current member), `assertFamilyMember(familyId, userId)` via `families.getMemberRole`.
3. `ws-handlers.ts` registers `ctx.hub.onFrame` for `typing`, `msg.read`, `presence.hide`, and `call.*` types (handlers added in later tasks). Every handler first re-checks authorisation (family membership at that moment) and returns `{t:"err", id, code:"forbidden"}` on failure; unknown conversation → `not_found`.
4. Facade `comms/index.ts` exports: `publishSystemMessage(familyId, conversationKind, card)`, `hasLiveCall(userId)`, `exportUserData(userId)`, `eraseUser(userId)`, `getCommsCounts(familyId)` (`@staff-safe`). Stubs until later tasks.
5. A shared `ws-envelope.ts` in `packages/shared/src/ws.ts` holds the TypeScript/Zod types for every frame in SRS §5.4 so web and admin can import them; the Dart equivalents are generated in the mobile tasks.
**Contract** — Frame envelope `{ "t": string, "id": uuid, "ts": iso, ... }`; acks `{ "t":"ack", "id": clientId }`; errors `{ "t":"err", "id", "code": "forbidden"|"not_found"|"invalid"|"rate_limited"|"busy" }`.
**Tests** — `ws-handlers.db.test.ts` (uses an in-process hub client): `frame from non-member gets forbidden`, `unknown frame type ignored`, `typing from member is broadcast to other members only`, `msg.read for foreign conversation not_found`.
**Acceptance** — `pnpm test:db -- comms/app/ws-handlers && pnpm arch`.
**Done when** — frames are authorised per message and typed in `packages/shared`.

### T-COMM-03 · Conversation membership handlers
- **Closes:** FR-CHAT-01, FR-FAM-01 (conversation creation), events catalogue §3.5
- **Depends on:** T-COMM-02
- **Milestone:** M3 · **Layer:** api
**Why** — Conversations must exist as soon as a family exists and follow membership changes.
**Files** — C `comms/app/membership-handlers.ts`, `membership-handlers.db.test.ts`; C `comms/app/backfill.ts` (+ job `comms.backfill-conversations` run once at startup when a flag row is missing).
**Steps**
1. Subscribe `families.FamilyCreated.v1 {familyId, ownerId}` [`comms.family-created`] → create the group conversation (title `সবাই`) and add the owner.
2. Subscribe `families.MemberJoined.v1 {familyId, userId, role}` [`comms.member-joined`] → add to the group conversation (set `left_at = null` if re-joining) and insert a system message `kind=system`, `meta {card:"member_joined", userId}`; direct conversations are created lazily on first use (T-COMM-04).
3. Subscribe `families.MemberRemoved.v1 {familyId, userId}` [`comms.member-removed`] → set `left_at = now()` on all the user's conversation memberships in that family (history stays readable to others; the removed user can no longer fetch). Also call `ctx.hub` to drop their family subscription (`ctx.hub.closeFamilySubscriptions(userId, familyId)`).
4. Backfill job: for every existing family without a group conversation, create it and add current members (the repository already has families created before this module existed).
**Contract** — Events as in SRS §3.5; handlers idempotent through `on conflict do nothing` on the unique indexes.
**Tests** — `membership-handlers.db.test.ts`: `family created creates group with owner`, `member joined added once on replay`, `member removed loses access`, `rejoin restores`, `backfill creates for legacy family`.
**Acceptance** — `pnpm test:db -- comms/app/membership-handlers`.
**Done when** — creating a family and joining a member in an integration test yields one group conversation with both members.

### T-COMM-04 · Conversation list and unread counts
- **Closes:** FR-CHAT-04, screen F1
- **Depends on:** T-COMM-03, T-COMM-05 (message table queries; can be developed in parallel with a fixture)
- **Milestone:** M3 · **Layer:** api
**Why** — The কথা tab and its badge need one fast query.
**Files** — C `comms/app/conversations.ts`, `comms/http/conversation-routes.ts`, `comms/app/conversations.db.test.ts`; M `packages/shared/src/schemas/comms.ts`.
**Steps**
1. `GET /v1/families/:familyId/conversations` returns the caller's conversations in the family ordered by last message time desc.
2. For each: last message `{id, kind, preview, senderId, createdAt}` (preview rules: text first 80 chars; voice `ভয়েস মেসেজ`; video `ভিডিও মেসেজ`; system card text; deleted `মুছে ফেলা হয়েছে`), `unread` = count of messages with `id > last_read_message_id` not sent by the caller and not deleted (single SQL with a lateral join; no N+1), `members` (userId, displayName from `families.listMembers`).
3. `POST /v1/families/:familyId/conversations` body `{ withUserId }` opens or returns the direct conversation (`direct_key` upsert). Errors: `invalid_request` if `withUserId` is the caller or not a member (404).
4. Response includes `totalUnread` for the tab badge.
**Contract**
```json
{ "totalUnread": 2,
  "items": [ { "id":"…","kind":"group","title":"সবাই","unread":2,
     "last":{"id":"…","kind":"text","preview":"আজ বাজারে ইলিশ উঠেছে, নেব?","senderId":"…","createdAt":"…"},
     "members":[{"userId":"…","displayName":"আম্মু"}] } ] }
```
**Tests** — `conversations.db.test.ts`: `ordering by last message`, `unread excludes own messages`, `unread resets after read`, `direct conversation created once for either order`, `non member gets 404`, `query count constant (assert ≤ 3 SQL statements for 20 conversations)`.
**Acceptance** — `pnpm test:db -- comms/app/conversations && pnpm openapi:check`.
**Done when** — list and badge counts are correct and the SQL-count assertion passes.

### T-COMM-05 · Send and list messages
- **Closes:** FR-CHAT-02, FR-CHAT-06 (server side), AC-18
- **Depends on:** T-COMM-02, T-COMM-03, T-NOTIF-05
- **Milestone:** M3 · **Layer:** api
**Why** — Core of chat: idempotent send, ordered history, fan-out over sockets and push.
**Files** — C `comms/app/messages.ts`, `comms/http/message-routes.ts`, `comms/app/messages.db.test.ts`; M `packages/shared/src/schemas/comms.ts` (`SendMessageSchema`, `MessageSchema`).
**Steps**
1. `POST /v1/conversations/:conversationId/messages` body `{ id: uuid /* client id */, body: string }` (1–2,000 chars after trim; reject whitespace-only). Steps: authz → family not suspended (T-COMM-20 guard) → rate limit `msg:{userId}` 60 per 60 s (`429 rate_limited` with `retryAfterSeconds`) → insert with `on conflict (conversation_id, client_id) do nothing returning`; if conflict, load and return the existing row with status 200 (idempotent), else 201.
2. Publish `comms.MessageSent.v1` in the same transaction.
3. After commit: `ctx.hub.publishToUsers(recipientIds, {t:"msg", message})` and for recipients with no live socket and kind preference on → `notifications.notify({kind:"message", skipInbox:true, params:{sender, preview}, push:{priority:"normal", channel:"chat"}, data:{conversationId, messageId}})` (chat does not fill the inbox; `skipInbox:true`).
4. `GET /v1/conversations/:conversationId/messages?cursor=&limit=` newest first, limit ≤ 50, cursor = message id (UUID v7 orders by time). Includes `deletedAt` rows as tombstones (`body: null`).
5. The message JSON: `{id, conversationId, clientId, senderId, kind, body, media?, meta, createdAt, deletedAt, receipts?: [{userId, readAt}]}`.
6. Members who left cannot list or send (`404`).
**Contract** — Errors: `invalid_request` (400), `not_found` (404), `rate_limited` (429), `family_suspended` (423).
**Tests** — `messages.db.test.ts`: `same client id twice gives one row and 200 second time`, `2000 chars ok 2001 rejected`, `trims and rejects blank`, `recipient with socket gets frame, offline gets fake push with 80 char preview`, `pagination returns 3 pages stable`, `removed member gets 404`, `rate limit 61st message in a minute`, `push preview never contains more than 80 chars`.
**Acceptance** — `pnpm test:db -- comms/app/messages && pnpm openapi:check`; message fan-out p95 ≤ 1 s in the test with a fake hub (assertion on elapsed time under 1000 ms for 100 recipients).
**Done when** — two clients exchange messages in a test with idempotent retries.

### T-COMM-06 · Read receipts and delete-own-message
- **Closes:** FR-CHAT-03, FR-CHAT-07
- **Depends on:** T-COMM-05
- **Milestone:** M3 · **Layer:** api
**Why** — Words like "পড়েছে" depend on server-side receipts; deletes must be limited to the sender and 24 hours.
**Files** — C `comms/app/receipts.ts`, `comms/app/delete-message.ts`, tests `receipts.db.test.ts`, `delete-message.db.test.ts`; C `comms/http/receipt-routes.ts`.
**Steps**
1. `POST /v1/conversations/:id/read` body `{ upTo: messageId }`: set `last_read_message_id` to the greater of old and `upTo` (UUID v7 compare); emit `{t:"msg.receipt", conversationId, userId, upTo}` to other members; return `{ lastReadMessageId }`.
2. The WS frame `msg.read` (client → server) does the same without REST; both call the same function.
3. Message JSON `receipts` is computed on read for the **sender's own** messages: for each other member whose `last_read_message_id >= message.id` → `{userId, readAt}`; "delivered" state = any live socket delivery recorded in `comms.message_delivery(message_id, user_id, delivered_at)` (add this small table in this task's migration; insert on socket publish success or when the app acks `t:"ack"` for the `msg` frame).
4. `DELETE /v1/messages/:id`: only the sender; only if `now - created_at ≤ 24 h`; sets `deleted_at = now()`, `body = null`; emits `{t:"msg.deleted", messageId}`; admins cannot delete others' messages (403 `forbidden`). Voice/video messages also enqueue media deletion (`comms.delete-media` job).
**Contract** — Errors: `forbidden` (403) for non-sender, `delete_window_closed` (409).
**Tests** — `receipts.db.test.ts`: `read pointer only moves forward`, `receipt frame to others`, `delivered recorded on ack`. `delete-message.db.test.ts`: `sender deletes within 24h`, `409 after 24h (fake clock)`, `admin forbidden`, `voice deletion enqueues media job`.
**Acceptance** — `pnpm test:db -- comms/app/receipts comms/app/delete-message`.
**Done when** — receipts and deletes behave per FR-CHAT-03 and -07.

### T-COMM-07 · System cards from ledger, call and family events
- **Closes:** FR-CHAT-05, FR-NUDGE-07, FR-BUD-06 (chat part), AC-19
- **Depends on:** T-COMM-05
- **Milestone:** M3 · **Layer:** api
**Why** — Expenses, buzzes and calls appear in the family thread (design `Chat`).
**Files** — C `comms/app/cards.ts`, `cards.db.test.ts`; M `comms/index.ts` (`publishSystemMessage`).
**Steps**
1. `publishSystemMessage(familyId, {card, text, meta})` inserts a `kind='system'` message with `sender_id` null into the group conversation, with `client_id = uuidv7()` and a `dedupeKey` inside `meta.dedupe` (unique partial index on `(conversation_id, (meta->>'dedupe'))` where present) for idempotency, then fans out like a normal message (no push).
2. Subscribe `ledger.TransactionCreated.v1 {familyId, transactionId, createdBy, createdByName, type, amountPaisa, categoryName, isPrivate}` [`comms.expense-card`]: if `isPrivate` → ignore; if `type != 'expense'` → ignore; else card `expense` text built per recipients' locale at render time (store parts in `meta` and let the client format): `meta {card:"expense", by:userId, category, amountPaisa, transactionId}`. Dedupe `"txn:"+transactionId`.
3. Subscribe `comms.NudgeSent.v1` [`comms.nudge-card`] → card `nudge` (`meta {from, to, phraseId}`), dedupe `"nudge:"+nudgeId`. Subscribe `comms.NudgeStateChanged.v1` with `state: replied` → card `nudge_reply`.
4. Subscribe `comms.CallEnded.v1` [`comms.call-card`] → card `call` (`meta {callId, outcome, durationSec, initiatorId}`).
5. Cards for transactions that later become private (update) are deleted via `ledger.TransactionUpdated.v1` with `isPrivate=true` → soft delete the card (`deleted_at`).
**Contract** — Card `meta.card` values: `member_joined`, `expense`, `nudge`, `nudge_reply`, `call`.
**Tests** — `cards.db.test.ts`: `non private expense creates card`, `private expense creates none`, `income creates none`, `update to private removes card`, `replay creates one card`, `nudge and reply cards`, `call outcome card`.
**Acceptance** — `pnpm test:db -- comms/app/cards`.
**Done when** — AC-19 passes.

### T-COMM-08 · Nudge phrase catalogue
- **Closes:** FR-NUDGE-01
- **Depends on:** T-COMM-01
- **Milestone:** M3 · **Layer:** api
**Why** — Phrases are server data so wording can change without an app release.
**Files** — C `comms/app/phrases.ts`, migration seed `apps/api/drizzle/00NN_comms_seed_phrases.sql` (or a `seed()` run by the migration runner), `comms/http/phrase-routes.ts`, `phrases.db.test.ts`.
**Steps**
1. Seed rows `(id, text_bn, text_en, sort)`: `come_eat` (`খেতে আসুন`, `Come and eat`, 1), `call_me` (`ফোন করুন`, `Please call`, 2), `come_home` (`বাড়ি আসুন`, `Come home`, 3), `log_expense` (`খরচ লিখুন`, `Log your spending`, 4), `take_medicine` (`ওষুধ খান`, `Take your medicine`, 5), `just_calling` (`শুধু ডাকছি`, `Just thinking of you`, 6), `budget_over` (`বাজেট শেষ`, `Budget is over`, 7).
2. `GET /v1/nudge-phrases?locale=bn` returns `{ items: [{id, text, textBn, textEn}] }` for active rows ordered by `sort`; `ETag` header from a hash of the rows (clients cache).
3. Facade `getPhrase(id)`; unknown id → `invalid_request` in the send task.
**Contract** — `Cache-Control: private, max-age=3600` plus ETag.
**Tests** — `phrases.db.test.ts`: `seeded seven phrases`, `ordered`, `ETag 304`, `inactive hidden`.
**Acceptance** — `pnpm test:db -- comms/app/phrases`.
**Done when** — all seven phrases are returned in Bangla and English.

### T-COMM-09 · Send a buzz
- **Closes:** FR-NUDGE-01, -02, -05, -06, -08 (server), FR-NOTIF-07, AC-15, AC-16
- **Depends on:** T-COMM-02, T-COMM-08, T-NOTIF-03, T-NOTIF-05
- **Milestone:** M3 · **Layer:** api
**Why** — The headline feature: reach a family member with a vibration.
**Files** — C `comms/app/nudges.ts`, `comms/http/nudge-routes.ts`, `comms/app/nudges.db.test.ts`; M `packages/shared/src/schemas/comms.ts` (`SendNudgeSchema`).
**Steps**
1. `POST /v1/families/:familyId/nudges` body:
```json
{ "recipientIds": ["uuid"], "phraseId": "come_eat", "intensity": "medium",
  "source": "manual", "sourceRef": null }
```
   `recipientIds` 1–6 entries, all current members, none equal to the caller; `intensity` in `soft|medium|strong` (default `medium`); `source` in `manual|budget_alert`.
2. Checks in order: authz member (viewers allowed) → family not suspended → phrase exists/active → rate limits **per sender→recipient**: `nudge:{sender}:{recipient}:min` 3 per 60 s and `…:hour` 20 per 3600 s; if any recipient is over, reject the whole request with `429 nudge_rate_limited` and `details {recipientId, retryAfterSeconds}`.
3. For each recipient insert a `nudges` row (state `sent`), publish `comms.NudgeSent.v1`.
4. Delivery per recipient: compute `quiet = await notifications.isQuietNow(recipientId)`. If the recipient has a live socket → `publishToUsers([r], {t:"nudge", nudgeId, from:{id,name}, phraseId, phrase /* in recipient locale */, intensity, quiet})`, set `state='delivered'`, `delivered_at=now()`; else → `notifications.notify({kind:"nudge", userIds:[r], familyId, params:{sender, phrase}, data:{nudgeId, senderId, senderName, phraseId, phrase, intensity, quiet}, push:{priority: quiet ? "normal" : "high", channel: quiet ? "alerts" : "nudge"}, skipInbox:false})`. (FCM delivery marks `delivered` when the app calls `POST /v1/nudges/:id/delivered`, T-COMM-10.)
5. Response `201`: `{ items: [{ nudgeId, recipientId, state, quietNow }] }` so the sender screen can show "চুপ সময়, পরে দেখবেন" (FR-NUDGE-06).
6. Sending while the **sender** is suspended or the family is suspended → `423 family_suspended`.
**Contract** — Errors: `invalid_request`, `not_found` (family or recipient not member), `nudge_rate_limited` (429), `family_suspended` (423).
**Tests** — `nudges.db.test.ts`: `connected recipient gets nudge frame within 2000ms and state delivered`, `offline recipient gets high priority data push on nudge channel`, `quiet recipient gets normal priority on alerts channel with quiet=1`, `4th buzz in a minute 429`, `21st in an hour 429`, `all-or-nothing on multi recipients`, `cannot buzz yourself`, `viewer can send`, `unknown phrase 400`, `phrase localised to recipient`, `suspended family 423`.
**Acceptance** — `pnpm test:db -- comms/app/nudges && pnpm openapi:check`; latency assertion for socket path < 2000 ms (NFR-17).
**Done when** — AC-15 and AC-16 server-side parts pass.

### T-COMM-10 · Buzz states and replies
- **Closes:** FR-NUDGE-03, FR-NUDGE-04, AC-15
- **Depends on:** T-COMM-09
- **Milestone:** M3 · **Layer:** api
**Why** — The sender must see "পৌঁছেছে", "দেখেছে" and the reply (আসছি / পরে বলছি / ফোন করি).
**Files** — C `comms/app/nudge-states.ts`, `comms/http/nudge-state-routes.ts`, `nudge-states.db.test.ts`.
**Steps**
1. `POST /v1/nudges/:id/delivered` (recipient only; idempotent) → state `delivered` if still `sent`; `delivered_at`.
2. `POST /v1/nudges/:id/seen` → state `seen` if `sent|delivered`; sets `seen_at`.
3. `POST /v1/nudges/:id/reply` body `{ reply: "coming" | "later" | "call" }` → state `replied`, store reply, `replied_at`; replies are accepted once (second call returns the existing state with 200). For `call` the response includes `{ startCall: true }` so the app opens a call (client then sends `call.invite`).
4. Every transition emits `comms.NudgeStateChanged.v1` and a WS frame to the sender `{t:"nudge.state", nudgeId, state, reply?}`; if the sender is offline, a push is **not** sent for `delivered`/`seen`, but is sent for `replied` through `notifications.notify({kind:"nudge", params:{sender, phrase: replyText}})` where `replyText` is `আসছি`, `পরে বলছি`, `ফোন করছি`.
5. Only the recipient can call these (404 for others). State can only move forward (`sent → delivered → seen → replied`); a late `delivered` after `seen` is ignored with 200.
**Contract** — Response `{ id, state, reply, startCall? }`.
**Tests** — `nudge-states.db.test.ts`: `forward only`, `sender notified by frame`, `offline sender gets push only for reply`, `reply once`, `other user 404`, `call reply returns startCall`, `state change events published`.
**Acceptance** — `pnpm test:db -- comms/app/nudge-states`; end-to-end test `sent → delivered → seen → replied` in `comms/e2e/nudge.e2e.test.ts`.
**Done when** — AC-15 passes.

### T-COMM-11 · Budget alert → "tell someone" support
- **Closes:** FR-BUD-06, FR-BUD-02
- **Depends on:** T-COMM-09, T-NOTIF-07
- **Milestone:** M3 · **Layer:** api
**Why** — The Home strip and budget card offer a button that buzzes a chosen member with "বাজেট শেষ".
**Files** — M `comms/app/nudges.ts` (accept `source: "budget_alert"` with `sourceRef = budgetId`), C `comms/app/budget-nudge.ts`, `budget-nudge.db.test.ts`.
**Steps**
1. Validate `source="budget_alert"` requires `phraseId="budget_over"` and a `sourceRef` that parses as a UUID; the module does not look up the budget (no cross-module data access); it stores `source_ref`.
2. Subscribe `budgeting.BudgetThresholdCrossed.v1` [`comms.budget-card`] → system card `budget` in the group conversation with `meta {categoryName, threshold}`; dedupe `"budget:"+budgetId+":"+month+":"+threshold`.
3. Add the rate-limit exemption **none** (budget nudges obey the same 3/min).
**Contract** — `nudges.source='budget_alert'`, `source_ref=<budgetId>`.
**Tests** — `budget-nudge.db.test.ts`: `budget alert source needs budget_over phrase`, `card created once`, `rate limit still applies`.
**Acceptance** — `pnpm test:db -- comms/app/budget-nudge`.
**Done when** — a budget-sourced nudge is accepted and appears as a card.

### T-COMM-12 · Presence and typing
- **Closes:** FR-PRES-01, FR-PRES-02, FR-CHAT-09, DEC-15, AC-22
- **Depends on:** T-COMM-02, T-NOTIF-03
- **Milestone:** M3 · **Layer:** api
**Why** — Home and member rows show who is online; users can hide it.
**Files** — C `comms/app/presence.ts`, `comms/http/presence-routes.ts`, `presence.db.test.ts`.
**Steps**
1. On `ctx.hub.onConnect(session)` and `onDisconnect(session)`: compute `online = hub.isOnline(userId)` (any device) and, if the user's `hide_presence` is false, publish `{t:"presence", userId, online}` to all members of all families they belong to who are online. Debounce disconnect by 10 s (job-less, in-memory timer) so a brief reconnect does not flap.
2. `GET /v1/families/:familyId/presence` returns `{ items: [{ userId, online, lastSeenBucket }] }` where `lastSeenBucket` is one of `now`, `today_morning`, `today_noon`, `today_evening`, `yesterday`, `earlier` (no exact times, DEC-15). Users with `hide_presence` appear as `online:false, lastSeenBucket:"earlier"`.
3. `last_seen_at` is kept in `comms.presence_seen(user_id pk, last_seen_at)` updated on disconnect (add to migration).
4. `presence.hide` frame toggles the preference through `notifications.setHidePresence(userId, hide)` (facade added in T-NOTIF-03's preferences app code; if missing, call the preference upsert function) and broadcasts the new state.
5. `typing` frames: forward `{t:"typing", conversationId, userId}` to other members, rate-limited to 1 per 2 s per user per conversation (drop silently).
**Contract** — As above.
**Tests** — `presence.db.test.ts`: `online frame on connect`, `debounced disconnect`, `hidden user shows offline`, `lastSeenBucket mapping with fake clock`, `typing rate limit drops`, `presence only visible to same-family members`.
**Acceptance** — `pnpm test:db -- comms/app/presence`; online/offline propagation ≤ 3 s in the test (AC-22).
**Done when** — AC-22 passes.

### T-COMM-13 · Voice notes: presign, confirm, validation
- **Closes:** FR-VNOTE-01, -02, -04, -05, AC-20, AC-21
- **Depends on:** T-COMM-05, storage capability
- **Milestone:** M3 · **Layer:** api
**Why** — Voice messages are recordings stored on the server (unlike voice entry), so limits and consent must be enforced.
**Files** — C `comms/app/voice-notes.ts`, `comms/http/voice-note-routes.ts`, `voice-notes.db.test.ts`; env `MEDIA_VOICE_MAX_BYTES=614400`, `MEDIA_VOICE_MAX_MS=60000`, `MEDIA_UPLOAD_TTL_SECONDS=600`.
**Steps**
1. `POST /v1/conversations/:id/voice-notes` body `{ durationMs, bytes, mime: "audio/mp4" | "audio/aac" , clientId }`:
   - Reject `durationMs > 60000` or `bytes > 614400` with `413 media_too_large`; reject unsupported `mime` with `415 media_type`.
   - Check consent: `identity.hasConsent(userId, "voice_notes_v1")` (T-ID adds the kind; the app records it on first use, FR-VNOTE-04); missing → `403 consent_required`.
   - Rate limit uploads: `media:{userId}:day` 40 per 86,400 s (`429 rate_limited`).
   - Create `media(status='pending', kind='voice', storage_key = "voice/{familyId}/{yyyy}/{mm}/{mediaId}.m4a", expires_at = now + 180 days)`.
   - Return `{ mediaId, upload: { url, method:"PUT", headers:{"Content-Type": mime}, expiresAt } }` from `storage.presignPut(key, {contentType, maxBytes, ttlSeconds: 600})`.
2. `POST /v1/voice-notes/:mediaId/confirm` body `{ clientId }`: owner only; `storage.head(key)`; require object exists and `ContentLength` within `[1, maxBytes]` and within 10% of declared `bytes` (else mark media `deleted`, delete object, `409 upload_mismatch`); set `status='ready'`; create the message (`kind='voice'`, `media_id`, `client_id = clientId`, `meta {durationMs}`) using the same send pipeline (rate limit, fan-out, push preview `ভয়েস মেসেজ`); idempotent on `(conversation_id, client_id)`.
3. Voice note audio is **never** passed to any AI service (code comment and a lint-free test that imports nothing from `ai`).
**Contract** — Errors: `media_too_large` (413), `media_type` (415), `consent_required` (403), `upload_mismatch` (409), `rate_limited` (429).
**Tests** — `voice-notes.db.test.ts` (MinIO): `61s rejected before presign`, `700KB rejected`, `consent missing 403`, `happy path presign-upload-confirm creates message`, `confirm without upload 409`, `size mismatch deletes object`, `confirm twice idempotent`, `41st upload in a day 429`, `non-member 404`.
**Acceptance** — `pnpm test:db -- comms/app/voice-notes`.
**Done when** — AC-20 (upload part) and AC-21 pass.

### T-COMM-14 · Signed media download and video messages
- **Closes:** FR-VNOTE-03, FR-VMSG-01, AC-20
- **Depends on:** T-COMM-13
- **Milestone:** M3 (media GET), M6 (video message routes behind flag `comms.video`)
- **Layer:** api
**Why** — Playback needs short-lived links checked against membership every time; video messages reuse the same pipeline.
**Files** — C `comms/app/media.ts`, `comms/http/media-routes.ts`, `comms/app/video-messages.ts`, `media.db.test.ts`, `video-messages.db.test.ts`; env `MEDIA_VIDEO_MAX_BYTES=8388608`, `MEDIA_VIDEO_MAX_MS=30000`, `MEDIA_DOWNLOAD_TTL_SECONDS=300`.
**Steps**
1. `GET /v1/media/:mediaId` → find media (must be `ready`), find the message referencing it, `assertConversationMember(message.conversation_id, userId)` (members who left lose access), return `{ url, expiresAt, contentType, bytes, durationMs }` with `storage.presignGet(key, 300)`. 404 otherwise. Never return storage keys.
2. Video messages (feature flag `comms.video`): `POST /v1/conversations/:id/video-messages` body `{ durationMs ≤ 30000, bytes ≤ 8 MiB, mime: "video/mp4", thumbBytes ≤ 60 KiB, clientId }` returns two presigned PUTs (`video`, `video_thumb`); `POST /v1/video-messages/:mediaId/confirm` verifies both objects and creates the message with `meta {durationMs, thumbMediaId}`. Push preview `ভিডিও মেসেজ`.
3. Rate limit shared with voice (40 per day).
**Contract** — As above; `Cache-Control: no-store` on the response.
**Tests** — `media.db.test.ts`: `member gets url`, `non member 404`, `removed member 404`, `pending media 404`, `url expires ≤ 300s (parse X-Amz-Expires)`, `no key leaked`. `video-messages.db.test.ts`: `31s rejected`, `9MB rejected`, `flag off 404`, `happy path with thumbnail`.
**Acceptance** — `pnpm test:db -- comms/app/media comms/app/video-messages`.
**Done when** — playback links work for members only and expire in ≤ 5 minutes.

### T-COMM-15 · Media retention and orphan cleanup
- **Closes:** FR-PRIV-06 (media), DEC-16, NFR-13 (storage alarm)
- **Depends on:** T-COMM-13
- **Milestone:** M3 · **Layer:** api
**Why** — Voice and video must disappear after 180 days; failed uploads must not pile up.
**Files** — C `comms/jobs.ts` entries, `comms/app/media-retention.ts`, `media-retention.db.test.ts`.
**Steps**
1. Job `comms.media-retention` daily `30 2 * * *` Asia/Dhaka: select `media` where `expires_at < now()` and `status='ready'` in batches of 200 → delete object, set `status='deleted'`, set the referencing message to `deleted_at = now(), body = null` (kept as tombstone "মেয়াদ শেষ").
2. Job `comms.media-orphans` every 30 minutes: `status='pending' and created_at < now() - interval '1 hour'` → delete object if present, set `deleted`.
3. Job `comms.delete-media` (enqueued by message deletes and erasure): input `{mediaId}`; idempotent.
4. Metric: per family storage bytes (`sum(bytes) where status='ready'`) written to `comms.family_media_bytes` view; facade `getCommsCounts` exposes totals; alarm threshold env `MEDIA_FAMILY_BYTES_ALARM=524288000` flagged in system health (T-ADM-12).
**Contract** — Job names above.
**Tests** — `media-retention.db.test.ts` (fake clock + MinIO): `ready media deleted after 180 days`, `message becomes tombstone`, `pending older than 1h removed`, `delete-media idempotent`, `alarm flag when over threshold`.
**Acceptance** — `pnpm test:db -- comms/app/media-retention`.
**Done when** — advancing the fake clock removes expired media and objects.

### T-COMM-16 · ICE servers endpoint (TURN credentials)
- **Closes:** FR-VIDEO-03, DEC-08
- **Depends on:** T-COMM-02
- **Milestone:** M6 · **Layer:** api
**Why** — Clients need STUN/TURN servers with credentials that expire.
**Files** — C `comms/infra/turn-credentials.ts`, `comms/http/rtc-routes.ts`, `turn-credentials.test.ts`; M `tools/fakes/docker-compose` (coturn service with `static-auth-secret`); env `TURN_URLS` (comma list, e.g. `stun:turn.example.com:3478,turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349?transport=tcp`), `TURN_SECRET`, `TURN_TTL_SECONDS=3600`.
**Steps**
1. `GET /v1/rtc/ice` (auth required; flag `comms.video`): `expiry = now + ttl`; `username = "{expiry}:{userId}"`; `credential = base64(HMAC-SHA1(TURN_SECRET, username))`; return `{ iceServers: [{urls:[...stun], }, {urls:[...turn], username, credential}], ttlSeconds }`.
2. Rate limit 30 per hour per user.
3. coturn config in Compose: `use-auth-secret`, `static-auth-secret=${TURN_SECRET}`, `realm`, `no-tcp-relay` off, `min-port/max-port`.
**Contract**
```json
{ "ttlSeconds": 3600, "iceServers": [ {"urls":["stun:…"]}, {"urls":["turn:…","turns:…"],"username":"1767000000:uuid","credential":"base64"} ] }
```
**Tests** — `turn-credentials.test.ts`: `username format`, `credential equals HMAC-SHA1 vector`, `expiry in future by ttl`, `no turn urls leaves stun only`; `rtc-routes.db.test.ts`: `401 without token`, `404 when flag off`, `rate limit`.
**Acceptance** — `pnpm test -- comms/infra/turn-credentials && pnpm test:db -- comms/http/rtc`; compose test `docker compose up -d coturn` then `turnutils_uclient` against it using a generated credential exits 0 (CI step in `verify:m6`).
**Done when** — a generated credential is accepted by coturn.

### T-COMM-17 · Call signalling and state machine
- **Closes:** FR-VIDEO-01, -03, -05 (server), AC-32
- **Depends on:** T-COMM-02, T-COMM-16
- **Milestone:** M6 · **Layer:** api
**Why** — 1:1 calls need an authoritative session so ringing, answering and ending are consistent across devices.
**Files** — C `comms/domain/call-machine.ts`, `call-machine.test.ts`; C `comms/app/calls.ts`, `calls.db.test.ts`; M `comms/app/ws-handlers.ts` (register `call.*`).
**Steps**
1. State machine per participant: `invited → ringing → joined | declined | missed`, and `joined → left`. Session outcome rules: `completed` when answered and ended; `declined` when all invited declined; `missed` on timeout; `busy` when the callee was already in a call; `cancelled` when the caller hangs up before answer; `failed` on ICE failure report.
2. Frames (client→server) `call.invite {callId (client uuid), familyId, to:[userId]}`; `call.accept {callId}`; `call.reject {callId}`; `call.offer {callId, to, sdp}`; `call.answer {callId, to, sdp}`; `call.ice {callId, to, candidate}`; `call.end {callId, reason?: "hangup"|"failed"}`. Server relays offer/answer/ice only between current participants of the same call (never logs SDP or candidates) and enforces size ≤ 16 KB per frame.
3. `call.invite`: authz (family members, family not suspended), max 1 recipient in P2 (more only when flag `comms.group_calls` is on, T-COMM-19), insert session and participants, send `{t:"call.invite", callId, from, mode}` to recipients. Busy detection: `comms.hasLiveCall(userId)` (participant with state `joined` or `ringing` in an unfinished session) → respond to the caller `{t:"call.rejected", callId, to, reason:"busy"}` and record outcome `busy`.
4. `call.accept` → participant `joined`, session `answered_at` set on first accept; server sends `{t:"call.accepted", callId, by}` to the initiator. `call.reject` → `declined`; `call.end` → participant `left`; when no joined participants remain, finish the session with `ended_at` and publish `comms.CallEnded.v1 {callId, familyId, outcome, durationSec}`.
5. A user can be in at most one unfinished call; a second `call.invite` from the same user returns `err busy`.
6. Disconnects: if the only joined participant's socket disconnects and does not reconnect within 20 s, end the call with `failed`.
**Contract** — SRS §5.4 frame list; `err` codes: `busy`, `forbidden`, `not_found`.
**Tests** — `call-machine.test.ts`: transition table cases for every outcome. `calls.db.test.ts`: `invite rings recipient`, `accept then offer/answer/ice relayed`, `non participant cannot relay`, `sdp not stored (no column, no log line — assert logger spy)`, `busy returned when callee in call`, `hangup before answer cancelled`, `disconnect timeout ends failed (fake timers)`, `suspended family cannot invite`. Two-client integration `comms/e2e/call.e2e.test.ts` exchanges frames through the real hub (AC-32 signalling part).
**Acceptance** — `pnpm test -- comms/domain/call-machine && pnpm test:db -- comms/app/calls`.
**Done when** — a scripted caller and callee complete invite → accept → offer/answer/ICE → end with the right outcome and event.

### T-COMM-18 · Ring timeout, missed calls, incoming-call push, call records
- **Closes:** FR-VIDEO-04, -07, -08, AC-33, FR-PRIV-06 (call logs)
- **Depends on:** T-COMM-17, T-NOTIF-05
- **Milestone:** M6 · **Layer:** api
**Why** — Callee without a socket must be woken by FCM; unanswered calls end as missed after 45 s.
**Files** — C `comms/app/call-ring.ts`, `call-ring.db.test.ts`; M `comms/jobs.ts`; C `comms/app/call-retention.ts`.
**Steps**
1. On `call.invite`, for each recipient: if socket online → frame; else `notifications.notify({kind:"call_incoming", ...})` — add kind `call_incoming` to T-NOTIF-01's list in this task (a migration-free change: the check is code-level; update the `inbox_items` check constraint via a new migration) with `push {priority:"high", channel:"calls"}`, ttl 45 s, `data {callId, callerId, callerName, startedAt}`, `skipInbox:true`; **never** downgraded by quiet hours (documented exception, T-NOTIF-05).
2. Enqueue `comms.call-ring-timeout` with `startAfter 45 s`, `singletonKey = callId`: if still unanswered → participants `missed`, session outcome `missed`, publish `CallEnded`, notify callee `call_missed` (inbox + normal push) and send `{t:"call.cancel", callId}` to cancel the ring on all devices.
3. Callee devices that wake from FCM fetch state with `GET /v1/calls/:callId` (participant only) returning `{callId, state, initiator, startedAt, ringExpiresAt}` and connect the socket, then send `call.accept` or `call.reject`.
4. Busy callee: the caller gets `call.rejected reason=busy`; the app offers a buzz (client side).
5. Retention: job `comms.call-retention` daily deletes `call_sessions`/`call_participants` older than 90 days (`ended_at`), after the call cards (which live in messages and are not deleted).
**Contract** — `GET /v1/calls/:callId` response above; push data keys as listed.
**Tests** — `call-ring.db.test.ts` (fake clock + jobs): `offline callee receives high priority calls-channel push`, `quiet hours do not suppress`, `ring timeout at 45s marks missed and notifies`, `accept before timeout cancels job`, `call.cancel sent`, `busy outcome`, `retention deletes after 90 days`.
**Acceptance** — `pnpm test:db -- comms/app/call-ring`.
**Done when** — AC-33 passes.

### T-COMM-19 · Group calls up to four people (P3)
- **Closes:** FR-VIDEO-02, FR-VIDEO-03 (mesh)
- **Depends on:** T-COMM-17
- **Milestone:** M6 (behind flag `comms.group_calls`, default off) · **Layer:** api
**Why** — Family video chats often include several people.
**Files** — M `comms/app/calls.ts`, `comms/domain/call-machine.ts`; C `comms/app/group-calls.db.test.ts`.
**Steps**
1. Allow `to` up to 3 users (total 4 including the initiator); a 5th participant gets `err invalid`.
2. Joining mid-call: `call.join {callId}` allowed for invited users while the session is unfinished; server sends `{t:"call.participant", callId, userId, state:"joined"}` to all joined participants; each pair negotiates offer/answer independently (client rule: the participant who joined later sends offers to existing ones).
3. Outcome rules: `completed` if at least two participants were joined at once; `missed` if nobody joined; per-participant `declined`/`missed` states retained.
4. Frames carry `to` always; the server rejects relaying to non-participants.
**Tests** — `group-calls.db.test.ts`: `fifth participant rejected`, `late join announces participant`, `relay only to named participant`, `flag off rejects more than one recipient`.
**Acceptance** — `pnpm test:db -- comms/app/group-calls`.
**Done when** — four test clients join and leave with correct states.

### T-COMM-20 · Suspension guard, privacy hooks and staff-safe counts
- **Closes:** FR-FAM-09 (comms), FR-PRIV-04, FR-ADM-11, DEC-18
- **Depends on:** T-COMM-05, T-PRIV-02
- **Milestone:** M3 · **Layer:** api
**Why** — A suspended family must not send; erased users must disappear; staff may see only counts.
**Files** — C `comms/app/guards.ts`, `comms/app/privacy-hooks.ts`, `comms/app/staff-counts.ts`, tests `guards.db.test.ts`, `privacy-hooks.db.test.ts`, `staff-counts.db.test.ts`; M `comms/index.ts`.
**Steps**
1. `assertFamilyWritable(familyId)` throws `HttpError(423, "family_suspended")` using `families.isSuspended`; called by send message, send nudge, voice/video confirm, `call.invite`. Reads stay allowed.
2. Privacy hooks registered with the privacy module's registry (T-PRIV-02): `exportUserData(userId)` returns `{ messages: [{conversationId, createdAt, kind, body}] }` for **messages the user sent** (no media files in P1, list of media ids and durations), nudges sent by the user; `eraseUser(userId)` (called from the `identity.UserErased.v1` handler [`comms.erase`]) does: set `body=null, deleted_at=now()` and `sender_id` stays (for ordering) but `meta.sender_erased=true` on all their text messages; enqueue `comms.delete-media` for all their media; delete their `nudges` as sender or recipient; delete `conversation_members` rows; delete `presence_seen`; delete direct conversations where either side is erased and no other messages remain; keep group conversation rows.
3. `getCommsCounts(familyId)` (`@staff-safe`) returns `{ conversations, messagesLast30d, voiceNotesLast30d, callsLast30d, mediaBytes }` numbers only; JSDoc `@staff-safe`.
**Contract** — Counts type has only numbers.
**Tests** — `guards.db.test.ts`: `suspended blocks every write path (table driven over routes)`, `reads still work`. `privacy-hooks.db.test.ts`: `export contains only own messages`, `erase redacts bodies`, `erase enqueues media deletion`, `erase deletes nudges both directions`, `other members' messages untouched`. `staff-counts.db.test.ts`: `returns numbers only (type test with expectTypeOf)`.
**Acceptance** — `pnpm test:db -- comms/app/guards comms/app/privacy-hooks comms/app/staff-counts`.
**Done when** — erasure and suspension behave per SRS FR-PRIV-04 and FR-FAM-09.

---

# T-SHOP: Shared bazaar list

Screen F5. Requirements FR-SHOP-01..04, AC-37.

### T-SHOP-01 · Schema, CRUD and list endpoints
- **Closes:** FR-SHOP-01, GAP-SHOP-01
- **Depends on:** platform skeleton, families facade
- **Milestone:** M7 · **Layer:** api
**Why** — Families keep a shared shopping list; everyone sees the same items.
**Files** — C `shopping/{index.ts,schema.ts,events.ts,jobs.ts}`, `shopping/http/routes.ts`, `shopping/app/lists.ts`, `shopping/app/lists.db.test.ts`, migration `00NN_shopping_init.sql`, `packages/shared/src/schemas/shopping.ts`; M `app.ts`.
**Steps**
1. `pgSchema("shopping")`: `lists(id uuid pk, family_id uuid not null, name text not null, archived_at timestamptz null, created_by uuid not null, created_at timestamptz default now())`; `items(id uuid pk, list_id uuid not null, name text not null check (length(name) between 1 and 80), qty_text text null check (length(qty_text) ≤ 30), est_price_paisa bigint null check (est_price_paisa ≥ 0), added_by uuid not null, checked_by uuid null, checked_at timestamptz null, position int not null, updated_at timestamptz not null default now(), deleted_at timestamptz null)`. Index `(list_id, position)`, `(family_id)` on lists. Unique partial index `(family_id) where archived_at is null and name = 'বাজার'` is **not** used; instead the default list is created lazily.
2. `GET /v1/families/:familyId/shopping-lists` → active lists (create the default `বাজার` list on first call). Viewers: read only.
3. `POST /v1/families/:familyId/shopping-lists` body `{ name }` (≤ 40 chars; max 5 active lists per family else `409 list_limit`).
4. `GET /v1/families/:familyId/shopping-lists/:listId` → list with items (non-deleted, ordered by `position`, unchecked first then checked).
5. `POST …/:listId/items` body `{ id?: uuid, name, qtyText?, estPricePaisa? }` (id lets offline clients retry); `PATCH …/items/:itemId` body any of `{name, qtyText, estPricePaisa, checked: boolean, position}`; `DELETE …/items/:itemId` (soft delete). `checked:true` sets `checked_by`/`checked_at`; `false` clears them.
6. Roles: members and above can write; viewers `403 forbidden` on writes; suspended families `423`.
**Contract**
```json
{ "id":"…","name":"চাল","qtyText":"২ কেজি","estPricePaisa":24000,"addedBy":"…","checkedBy":null,"checkedAt":null,"position":3,"updatedAt":"…" }
```
**Tests** — `lists.db.test.ts`: `default list created once`, `list limit 5`, `item create idempotent by id`, `check sets checker`, `viewer cannot write`, `suspended 423`, `cross family 404`.
**Acceptance** — `pnpm test:db -- shopping/app/lists && pnpm openapi:check`.
**Done when** — CRUD works and is tenant-safe.

### T-SHOP-02 · Realtime item events and conflict rule
- **Closes:** FR-SHOP-02 (realtime), AC-37, DEC-14
- **Depends on:** T-SHOP-01, WebSocket hub
- **Milestone:** M7 · **Layer:** api
**Why** — Two people at the bazaar and at home must see ticks within a second.
**Files** — C `shopping/app/realtime.ts`, `realtime.db.test.ts`; M `shopping/app/lists.ts`.
**Steps**
1. After each item write commit, publish WS frame `{t:"shopping.item", listId, item, op: "upsert"|"delete"}` to all other members of the family who are online (`families.listMembers`).
2. Conflict rule (last write wins per item by `updated_at`): a `PATCH` may carry `ifUpdatedAt`; when present and older than the stored `updated_at`, apply only fields not changed since (simple field merge: the server keeps the later value for `checked`) and return the merged item with `200`; never `409`.
3. Offline clients replay queued edits with their original `updatedAt` as `clientUpdatedAt` in the body; server ignores a field edit when `clientUpdatedAt < field_updated_at[field]` (store `field_updated_at jsonb` on items in the migration of this task).
4. `GET …/shopping-lists/:id?since=<iso>` returns only changed items (including deleted tombstones) for fast refresh.
**Contract** — WS frame as above (also added to `packages/shared/src/ws.ts`).
**Tests** — `realtime.db.test.ts`: `second client receives frame within 1000 ms`, `delete sends op delete`, `older client edit does not overwrite newer check`, `since returns tombstones`, `viewer receives frames`.
**Acceptance** — `pnpm test:db -- shopping/app/realtime`.
**Done when** — AC-37 realtime part passes.

### T-SHOP-03 · To-expense and archive
- **Closes:** FR-SHOP-03, FR-SHOP-04
- **Depends on:** T-SHOP-01, `ledger.findCategoryByKey`
- **Milestone:** M7 · **Layer:** api
**Why** — "বাজারে খরচ লিখুন" turns the ticked items into a draft; finishing a list archives it.
**Files** — C `shopping/app/to-expense.ts`, `shopping/app/archive.ts`, tests, `shopping/jobs.ts`.
**Steps**
1. `POST /v1/families/:familyId/shopping-lists/:listId/to-expense` → returns a **draft** (never writes to the ledger): `{ draft: { type:"expense", amountPaisa: sum(est_price of checked items), categoryId: ledger.findCategoryByKey(familyId,"bazaar")?.id ?? null, note: "বাজার: চাল, ডাল, ইলিশ" (first 5 checked names joined, ≤ 120 chars), source:"manual", occurredAt: now }, itemIds: [...] }`. If no item has a price, `amountPaisa: 0` and the app asks for the amount.
2. `POST …/:listId/archive` sets `archived_at` (allowed when at least one item is checked); a new empty default list is created automatically when the default list is archived. Keep the last 10 archived lists per family; job `shopping.prune-archives` weekly deletes older ones with their items.
3. `GET /v1/families/:familyId/shopping-lists?archived=true` returns archived lists.
**Contract** — Draft shape equals `TransactionDraftSchema` in `packages/shared` so clients reuse the confirm screen.
**Tests** — `to-expense.db.test.ts`: `sums checked prices only`, `note lists first five`, `no ledger write (ledger table count unchanged)`, `zero when no prices`, `archive creates new default`, `prune keeps 10`.
**Acceptance** — `pnpm test:db -- shopping/app/to-expense shopping/app/archive`.
**Done when** — AC-37 "to expense" part passes.

---

# T-LEND: Dhar (money lent and borrowed)

Screen E8. FR-LEND-01..04, AC-41, BR-18.

### T-LEND-01 · Schema and CRUD
- **Closes:** FR-LEND-01, GAP-LEND-01
- **Depends on:** platform skeleton, families facade
- **Milestone:** M8 · **Layer:** api
**Why** — Families lend and borrow informally and forget.
**Files** — C `lending/{index.ts,schema.ts,events.ts,jobs.ts}`, `lending/http/routes.ts`, `lending/app/dhar.ts`, `lending/app/dhar.db.test.ts`, migration, `packages/shared/src/schemas/lending.ts`; M `app.ts`.
**Steps**
1. Tables: `dhar(id uuid pk, family_id uuid not null, direction text not null check in ('to_receive','to_give'), person_name text not null check (length between 1 and 60), person_phone text null, amount_paisa bigint not null check (> 0), date date not null, due_date date null, note text null check (length ≤ 200), is_private boolean not null default false, created_by uuid not null, settled_at timestamptz null, created_at timestamptz default now(), deleted_at timestamptz null)`; index `(family_id, settled_at, due_date)`.
2. Routes: `GET /v1/families/:id/dhar?direction=&status=open|settled|overdue`, `POST` (client `id` optional), `GET /:dharId`, `PATCH /:dharId` (creator or Admin+), `DELETE /:dharId` (soft).
3. Visibility: private entries are returned only to `created_by`; non-private to all non-viewer members (viewers `403`, they have no ledger detail rights).
4. Roles: Members create; edit/delete own; Admin+ edit any non-private.
**Contract** — Response includes `paidPaisa`, `remainingPaisa`, `status` (derived in T-LEND-02).
**Tests** — `dhar.db.test.ts`: `create both directions`, `private hidden from others`, `viewer 403`, `member edits own only`, `amount must be positive`, `cross family 404`.
**Acceptance** — `pnpm test:db -- lending/app/dhar && pnpm openapi:check`.
**Done when** — CRUD works with privacy rules.

### T-LEND-02 · Repayments and derived status
- **Closes:** FR-LEND-02, FR-LEND-04, AC-41
- **Depends on:** T-LEND-01
- **Milestone:** M8 · **Layer:** api
**Why** — Partial payments are the norm; status must be computed, not typed.
**Files** — C `lending/domain/status.ts`, `status.test.ts`; C `lending/app/repayments.ts`, `repayments.db.test.ts`.
**Steps**
1. Table `dhar_repayments(id uuid pk, dhar_id uuid not null, amount_paisa bigint not null check (> 0), paid_on date not null, note text null, created_by uuid not null, created_at timestamptz default now())`.
2. `POST /v1/families/:id/dhar/:dharId/repayments` body `{ amountPaisa, paidOn, note? }`; reject if it would exceed remaining (`409 over_repayment`). When remaining reaches 0 set `settled_at`.
3. `POST …/:dharId/settle` marks settled and inserts a closing repayment for the remaining amount (the "ফেরত পেয়েছি" button).
4. `deriveStatus({amount, paid, dueDate, settledAt, today})` → `settled` | `overdue` (due date before today in Dhaka and remaining > 0) | `partly_paid` (0 < paid < amount) | `open`.
5. FR-LEND-04: dhar entries are never read by `reporting`; repayments carry an optional `linkedTransactionId` (nullable uuid, validated by `ledger.transactionExists(familyId, id)` facade); only linked repayments can be referenced by the ledger.
**Contract** — Error `over_repayment` (409).
**Tests** — `status.test.ts`: table of all four statuses and boundaries (due today is not overdue). `repayments.db.test.ts`: `partial then settle`, `over repayment 409`, `settle closes with remainder`, `deleted entry hides repayments`, `no reporting import (arch test)`.
**Acceptance** — `pnpm test -- lending/domain && pnpm test:db -- lending/app/repayments && pnpm arch`.
**Done when** — AC-41 passes.

### T-LEND-03 · Due reminders and privacy hooks
- **Closes:** FR-LEND-03, FR-PRIV-04
- **Depends on:** T-LEND-02, T-NOTIF-05
- **Milestone:** M8 · **Layer:** api
**Why** — Remind on and 3 days before the due date; erase on account deletion.
**Files** — C `lending/jobs.ts`, `lending/app/due-reminders.ts`, `lending/app/privacy-hooks.ts`, tests; M `lending/events.ts` (`lending.DharDue.v1 {familyId, dharId, createdBy, personName, remainingPaisa, dueOn, daysBefore}`).
**Steps**
1. Job `lending.due-sweep` daily `0 3 * * *` UTC (09:00 Dhaka): for open entries with `due_date - today in (0, 3)`, publish `DharDue` with `dedupe` in the outbox id (`dhar:{id}:{daysBefore}`); T-NOTIF-07 turns it into a notification to `created_by` only.
2. Privacy hooks: `exportUserData(userId)` returns the user's own dhar rows; `eraseUser(userId)` deletes dhar rows they created (private ones and any others) and their repayments; entries created by others are untouched.
3. Facade `getLendingCounts(familyId)` (`@staff-safe`) returns `{ open, settled }` numbers.
**Tests** — `due-reminders.db.test.ts`: `fires at 3 days and 0 days once`, `settled never fires`, `private entry still notifies only creator`; `privacy-hooks.db.test.ts`: `export own`, `erase own only`.
**Acceptance** — `pnpm test:db -- lending`.
**Done when** — reminders and erasure work.

---

# T-BILL: Plans and payments

Screen E7 and admin G1. FR-BILL-01..07, DEC-09, DEC-10, AC-39, AC-40, BRD §8. `entitlements` is needed early (M2) by `ai` and `families`, so T-BILL-01 and T-BILL-02 ship first with Free defaults.

### T-BILL-01 · Schema, plan catalogue and seed
- **Closes:** FR-BILL-01, GAP-BILL-01
- **Depends on:** platform skeleton
- **Milestone:** M2 (catalogue and entitlements), M8 (payments) · **Layer:** api
**Why** — Plan limits must live in data so staff can change them.
**Files** — C `billing/{index.ts,schema.ts,events.ts,jobs.ts}`, `billing/app/catalogue.ts`, `billing/app/catalogue.db.test.ts`, migration with seed; M `app.ts`.
**Steps**
1. Tables (`pgSchema("billing")`): `plans(id text pk, name_bn text, name_en text, price_month_paisa bigint, price_year_paisa bigint null, currency text default 'BDT', sort int, active boolean default true)`; `plan_limits(plan_id text, key text, int_value int null, bool_value boolean null, primary key (plan_id, key))`; keys: `members_max`, `ai_entries_month`, `history_months` (null = unlimited), `receipt_vision`, `ask`, `export_beyond_csv`, `multi_currency`, `remittance_planner`.
2. Seed: `free` (৳0): members 3, ai 100, history 6, receipt false, ask false, export false; `plus` (৳9900 month = 99 taka → store paisa `9900`, year `99900`): members 8, ai 1000, history null, receipt true, ask true, export true; `probashi` (14900): plus + `multi_currency` true + `remittance_planner` true.
3. Facade `getPlanCatalogue()`; `GET /v1/plans` returns `{ items: [{id, nameBn, nameEn, priceMonthPaisa, priceYearPaisa, limits}] }` (public to authenticated users).
**Contract** — As above.
**Tests** — `catalogue.db.test.ts`: `seed has three plans`, `limits typed`, `GET /v1/plans`.
**Acceptance** — `pnpm test:db -- billing/app/catalogue`.
**Done when** — catalogue is queryable.

### T-BILL-02 · Entitlements facade
- **Closes:** FR-BILL-05, FR-FAM-10, FR-AI-12 (quota source), DEC-10
- **Depends on:** T-BILL-01
- **Milestone:** M2 · **Layer:** api
**Why** — Other modules need limits without reading billing tables.
**Files** — C `billing/app/entitlements.ts`, `entitlements.db.test.ts`; M `billing/index.ts`.
**Steps**
1. Table `billing.subscriptions` is created in T-BILL-05; until then `entitlements` returns Free for everyone, with `quota override` table `billing.family_overrides(family_id pk, ai_entries_month int null, members_max int null, reason text, set_by uuid, set_at timestamptz)` created here (staff can add AI entries in T-ADM-08).
2. `entitlements(familyId): Promise<Entitlements>`:
```ts
type Entitlements = { planId: "free"|"plus"|"probashi"; state: "active"|"past_due"|"canceled_at_period_end"|"expired"|"none";
  membersMax: number; aiEntriesMonth: number; historyMonths: number | null;
  features: { receiptVision: boolean; ask: boolean; exportBeyondCsv: boolean; multiCurrency: boolean; remittancePlanner: boolean };
  periodEnd: string | null };
```
   Effective values = plan limits, overridden by `family_overrides`, and if `state in (expired)` fall back to Free values. Cache per family 60 s in memory, busted by `billing.SubscriptionChanged.v1` and by override writes.
3. Facade also exposes `assertFeature(familyId, "ask")` throwing `HttpError(402, "plan_required", …, {feature})` and `assertMemberCapacity(familyId, currentCount)` throwing `HttpError(409, "plan_member_limit")` — used by `families` and `ai`.
4. `GET /v1/families/:familyId/entitlements` for the app (any member).
**Contract** — Errors: `plan_required` (402), `plan_member_limit` (409).
**Tests** — `entitlements.db.test.ts`: `defaults to free`, `override raises ai entries`, `expired falls back`, `cache busted on change`, `assertFeature throws 402 with feature`, `member capacity boundary (3 ok, 4th blocked)`.
**Acceptance** — `pnpm test:db -- billing/app/entitlements`.
**Done when** — `ai` and `families` can import `billing.entitlements` and tests pass.

### T-BILL-03 · PaymentGateway port and fake gateway
- **Closes:** DEC-09, AC-39 (test infrastructure)
- **Depends on:** T-BILL-01
- **Milestone:** M8 · **Layer:** api
**Why** — Real wallets cannot be used in CI; the contract must be the same for all providers.
**Files** — C `billing/infra/payment-gateway.ts`, `billing/infra/fake-gateway.ts`, `tools/fakes/payment-gateway/server.ts` (standalone HTTP server exposing a hosted checkout page and webhook sender), tests.
**Steps**
1. Interface:
```ts
export interface PaymentGateway {
  readonly provider: "bkash" | "nagad" | "sslcommerz";
  createCheckout(i: { paymentId: string; amountPaisa: number; currency: "BDT"; description: string; returnUrl: string; cancelUrl: string; customerPhone?: string }): Promise<{ providerRef: string; checkoutUrl: string; expiresAt: Date }>;
  verifyWebhook(headers: Record<string,string>, rawBody: Buffer): { ok: true; event: GatewayEvent } | { ok: false; reason: string };
  queryPayment(providerRef: string): Promise<{ status: "pending"|"paid"|"failed"|"cancelled"; paidAmountPaisa?: number }>;
}
export type GatewayEvent = { eventId: string; providerRef: string; status: "paid"|"failed"|"cancelled"; amountPaisa: number; occurredAt: Date };
```
2. Fake gateway: signs webhooks with HMAC-SHA256 header `x-fake-signature` using `FAKE_GATEWAY_SECRET`; the fake server has `POST /__pay/:providerRef` to simulate paid/failed and sends the webhook to the API, with an option to replay the same event twice.
3. Adapter selection by env `BILLING_BKASH_DRIVER=live|fake` (and the same for nagad, sslcommerz), default `fake` outside production.
**Tests** — `fake-gateway.test.ts`: `signature verifies`, `tampered body fails`, `replay produces identical eventId`.
**Acceptance** — `pnpm test -- billing/infra`.
**Done when** — a test can create a checkout and simulate a paid webhook through the fake server.

### T-BILL-04 · bKash, Nagad and SSLCommerz adapters
- **Closes:** FR-BILL-02, BRD §9 (no PIN)
- **Depends on:** T-BILL-03
- **Milestone:** M8 · **Layer:** api
**Why** — Production gateways differ; adapters keep that out of the rest of the code.
**Files** — C `billing/infra/bkash-gateway.ts`, `nagad-gateway.ts`, `sslcommerz-gateway.ts`, `billing/infra/http-client.ts`, contract tests with recorded fixtures `billing/infra/__fixtures__/*.json`; env: `BKASH_BASE_URL, BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD, BKASH_WEBHOOK_SECRET`, `NAGAD_BASE_URL, NAGAD_MERCHANT_ID, NAGAD_PUBLIC_KEY, NAGAD_PRIVATE_KEY`, `SSLCOMMERZ_STORE_ID, SSLCOMMERZ_STORE_PASSWORD, SSLCOMMERZ_BASE_URL`.
**Steps**
1. Each adapter implements the port using the provider's hosted checkout (tokenised checkout for bKash, Nagad online payment, SSLCommerz session API). They only build the redirect URL and verify callbacks; the app and the API **never** collect a PIN, OTP or card number.
2. All outbound calls: timeout 10 s, one retry on 5xx, request/response bodies logged with phone numbers masked (`logger` redaction paths in config).
3. Each adapter ships with recorded-fixture tests (`nock`-style) so CI needs no credentials: `creates checkout`, `verifies webhook signature`, `query maps statuses`.
4. Startup check: if a driver is `live` and any required env var is missing, the process refuses to start (config validation).
**Tests** — `bkash-gateway.test.ts`, `nagad-gateway.test.ts`, `sslcommerz-gateway.test.ts` (fixtures).
**Acceptance** — `pnpm test -- billing/infra`; `NODE_ENV=production BKASH_DRIVER=live pnpm --filter api start` exits non-zero with a message naming the missing variable (test via `config.test.ts`).
**Done when** — adapters are selectable and fixture-tested.

### T-BILL-05 · Checkout, subscriptions and invoices
- **Closes:** FR-BILL-02, FR-BILL-06, GAP-BILL-01
- **Depends on:** T-BILL-02, T-BILL-03
- **Milestone:** M8 · **Layer:** api
**Why** — The app starts a payment and later shows the active plan and invoices.
**Files** — C migration adding `subscriptions`, `payments`, `invoices`; C `billing/app/checkout.ts`, `billing/http/routes.ts`, tests.
**Steps**
1. Tables: `subscriptions(id uuid pk, family_id uuid not null unique, plan_id text not null, interval text check in ('month','year'), state text not null check in ('active','past_due','canceled_at_period_end','expired'), current_period_start timestamptz, current_period_end timestamptz, grace_until timestamptz null, canceled_at timestamptz null, created_at, updated_at)`; `payments(id uuid pk, family_id uuid, subscription_id uuid null, plan_id text, interval text, provider text, provider_ref text null, amount_paisa bigint, currency text, status text check in ('created','pending','paid','failed','cancelled','expired'), checkout_url text, created_by uuid, created_at, paid_at null)`; `invoices(id uuid pk, number text unique, family_id uuid, payment_id uuid unique, plan_id text, period_start, period_end, amount_paisa bigint, status text default 'paid', issued_at)`. Invoice numbers `APB-{yyyy}-{seq 6 digits}` from a sequence.
2. `POST /v1/families/:familyId/subscription/checkout` body `{ planId: "plus"|"probashi", interval: "month"|"year", provider: "bkash"|"nagad"|"sslcommerz" }` (Owner only; `probashi` has no yearly price → `invalid_request`). Creates a `payments` row (`created`), calls `gateway.createCheckout` with `returnUrl = {APP_PUBLIC_URL}/billing/return?paymentId=…`, stores `provider_ref`, sets `pending`, returns `{ paymentId, checkoutUrl, expiresAt }`. If the family already has an active subscription of the same plan and interval → `409 already_subscribed`.
3. `GET /v1/families/:familyId/subscription` → `{ planId, state, interval, periodEnd, graceUntil, entitlements }`; `POST …/subscription/cancel` → `canceled_at_period_end`; `GET …/invoices` → list; `GET …/invoices/:id.pdf` created in T-BILL-08.
4. `GET /v1/payments/:paymentId` (creator or Owner of that family) for the return page to poll status (`status`, `planId`).
**Contract** — Errors: `forbidden` (403 non-owner), `already_subscribed` (409), `invalid_request`.
**Tests** — `checkout.db.test.ts` with fake gateway: `owner can start checkout`, `admin cannot`, `probashi yearly rejected`, `payment row pending with providerRef`, `already subscribed 409`, `status endpoint only for owner`.
**Acceptance** — `pnpm test:db -- billing/app/checkout && pnpm openapi:check`.
**Done when** — a checkout URL is produced through the fake gateway.

### T-BILL-06 · Webhooks (signed, idempotent)
- **Closes:** FR-BILL-03, AC-39
- **Depends on:** T-BILL-05
- **Milestone:** M8 · **Layer:** api
**Why** — Money events arrive out of band and can repeat.
**Files** — C `billing/http/webhook-routes.ts`, `billing/app/webhooks.ts`, `webhooks.db.test.ts`; table `webhook_events(provider text, event_id text, received_at timestamptz, payload_hash text, primary key (provider, event_id))`.
**Steps**
1. Routes `POST /v1/webhooks/bkash`, `/nagad`, `/sslcommerz` registered with raw-body parsing (`addContentTypeParser` returning `Buffer` for these routes only) and **no** auth hook; they are rate limited 600/min per IP.
2. Handler: `gateway.verifyWebhook` → on failure `401 invalid_signature` (log provider and reason, never the body). Insert `(provider, event_id)` with `on conflict do nothing`; if conflict → return `200 {duplicate:true}` immediately (idempotency).
3. Look up `payments` by `provider_ref`; check `amountPaisa` equals the payment amount (else mark payment `failed`, log `amount_mismatch`, return 200); for `paid` status and payment not already `paid`: in one transaction set payment `paid`, create or update the subscription (T-BILL-07 `activateSubscription`), create the invoice, publish `billing.SubscriptionChanged.v1 {familyId, planId, state, periodEnd, reason:"payment"}`.
4. Also a job `billing.reconcile-payments` every 10 minutes: for `pending` payments older than 5 minutes (up to 24 h) call `queryPayment`; if `paid`, run the same path (covers lost webhooks).
**Contract** — Webhook responses are always `200` for verified events (duplicate or not), `401` for invalid signature, `400` malformed.
**Tests** — `webhooks.db.test.ts`: `paid webhook activates plus`, `replayed webhook changes nothing (same subscription row, one invoice)`, `bad signature 401 and no state change`, `amount mismatch fails payment`, `unknown providerRef ignored 200`, `reconcile job finds paid payment`, `out-of-order failed after paid ignored`.
**Acceptance** — `pnpm test:db -- billing/app/webhooks`.
**Done when** — AC-39 passes.

### T-BILL-07 · Subscription state machine, grace and downgrade
- **Closes:** FR-BILL-04, FR-BILL-07, AC-40
- **Depends on:** T-BILL-06
- **Milestone:** M8 · **Layer:** api
**Why** — Subscriptions end; data must stay while features above Free limits become read-only.
**Files** — C `billing/domain/subscription-machine.ts`, `.test.ts`; C `billing/app/subscription-jobs.ts`, `.db.test.ts`; M `billing/jobs.ts`.
**Steps**
1. Pure state machine: `activate(now, plan, interval)` sets period (month: +1 calendar month in Dhaka; year: +12) and `active`; `renewReminder` at `period_end - 3 days` (notification kind `plan_changed` with `params.reason="renewal"`); at `period_end` with no payment → `past_due` with `grace_until = period_end + 3 days`; after grace → `expired`; `cancel()` → `canceled_at_period_end`, expiring at period end with no grace.
2. Job `billing.subscription-sweep` hourly: applies transitions, publishes `SubscriptionChanged` with `reason: "past_due"|"expired"|"canceled"`.
3. Downgrade rules, enforced through `entitlements` (not by deleting data): when `state=expired` Free limits apply: `members_max 3` (existing extra members stay; only inviting is blocked, `assertMemberCapacity` counts current members), AI quota 100, `ask` and `receipt_vision` return `402 plan_required`, history limit 6 months hides older transactions in list/report queries **only when** `historyMonths` is not null (the `reporting`/`ledger` modules read `entitlements.historyMonths`; this task adds the facade field and a documented contract test in `billing`; the filter itself is implemented in T-LED/T-REP); older data returns on upgrade.
4. Renewal by a new payment while `past_due` or `active` extends from the later of now and current period end.
**Tests** — `subscription-machine.test.ts`: month and year periods across month ends (31 Jan → 28 Feb), grace boundaries, cancel then expiry, renewal extension. `subscription-jobs.db.test.ts` (fake clock): `active → past_due → expired`, `entitlements fall back to free`, `extra members remain`, `upgrade restores features`.
**Acceptance** — `pnpm test -- billing/domain && pnpm test:db -- billing/app/subscription-jobs`.
**Done when** — AC-40 passes.

### T-BILL-08 · Invoice PDF and SubscriptionChanged handlers
- **Closes:** FR-BILL-06, DEC-10
- **Depends on:** T-BILL-05, T-BILL-07
- **Milestone:** M8 · **Layer:** api
**Why** — Users download invoices; other modules react to plan changes.
**Files** — C `billing/infra/invoice-pdf.ts` (using `pdfkit`, Hind Siliguri font bundled at `billing/infra/fonts/`), `invoice-pdf.test.ts`; C `billing/http/invoice-routes.ts`; M `apps/api/package.json`.
**Steps**
1. `GET /v1/families/:familyId/invoices/:invoiceId.pdf` (Owner/Admin) streams a one-page PDF (family name, invoice number, plan, period, amount in ৳ with Bangla numerals, payment provider and masked reference). Content-Type `application/pdf`; filename `APB-2026-000012.pdf`.
2. Handlers in other modules (their own tasks, listed here for tracing): `families` re-evaluates member limits on `SubscriptionChanged`; `ai` clears quota cache; `notifications` notifies the Owner (T-NOTIF-07). This task adds the contract test `billing/events.contract.test.ts` that parses the event with the shared Zod schema.
**Tests** — `invoice-pdf.test.ts`: `renders non-empty pdf with Bangla glyphs (pdf text extraction contains "৳")`, `amount matches invoice`; `invoice-routes.db.test.ts`: `owner can download`, `member cannot`, `other family 404`.
**Acceptance** — `pnpm test -- billing/infra/invoice-pdf && pnpm test:db -- billing/http/invoice-routes`.
**Done when** — PDFs download for the Owner only.

---

# T-PRIV: Privacy

Screens A2, F7, F8, admin C4. FR-PRIV-01..07, FR-AUTH-05/-10, NFR-07, AC-27, AC-28. All modules plug into two registries owned here: **export hooks** and **erase hooks**.

### T-PRIV-01 · Module, requests table and policy endpoint
- **Closes:** FR-PRIV-01, FR-PRIV-02, FR-PRIV-05 (record), GAP-PRIV-01
- **Depends on:** platform skeleton
- **Milestone:** M1 (policy) and M5 (rest) · **Layer:** api
**Why** — Consent screens need the policy text and version; privacy workflows need one record per request.
**Files** — C `privacy/{index.ts,schema.ts,events.ts,jobs.ts}`, `privacy/http/policy-routes.ts`, `privacy/domain/policy.ts` (policy text in `privacy/domain/policy-bn.md` and `policy-en.md`, loaded at build), migration, tests; M `app.ts`.
**Steps**
1. Tables (`pgSchema("privacy")`): `requests(id uuid pk, user_id uuid not null, kind text check in ('export','erasure'), status text check in ('open','in_progress','done','rejected','cancelled') default 'open', step text not null, requested_at timestamptz default now(), due_at timestamptz not null, completed_at timestamptz null, grace_until timestamptz null, meta jsonb default '{}', rejected_reason text null)`; `export_files(id uuid pk, request_id uuid, storage_key text, bytes bigint, expires_at timestamptz, created_at timestamptz default now())`; indexes `(user_id, kind, status)`, `(status, due_at)`. A unique partial index allows one open erasure and one open export per user.
2. `due_at = requested_at + 30 days` (PDPO, FR-PRIV-03/04).
3. `GET /v1/policy?locale=bn|en` returns `{ version: "2026-11-01", locale, text: "<markdown>", updatedAt }` (unauthenticated; the consent screen shows it before login). The version constant `POLICY_VERSION` lives in `privacy/domain/policy.ts` and is exported by the facade `getCurrentPolicyVersion()` used by `identity.consents` (T-ID).
4. Policy text must mention: what is collected, the AI cross-border processing, voice notes stored 180 days, retention table (FR-PRIV-06), rights (export, erasure within 30 days), contact. A test checks the headings and that every retention figure in the text equals the constants in `retention.ts` (T-PRIV-05).
**Contract** — Policy response above; request records are internal until T-PRIV-02/03 expose routes.
**Tests** — `policy.db.test.ts`: `bn and en served`, `version present`, `unauthenticated allowed`, `unknown locale 400`; `policy-content.test.ts`: `retention numbers match constants`.
**Acceptance** — `pnpm test -- privacy && pnpm test:db -- privacy/policy`.
**Done when** — the consent screen can fetch both languages and a version string.

### T-PRIV-02 · Export hook registry and export job
- **Closes:** FR-PRIV-03, AC-27
- **Depends on:** T-PRIV-01, storage capability, T-NOTIF-05
- **Milestone:** M5 · **Layer:** api
**Why** — Users own their data; every module contributes its part without privacy knowing the schemas.
**Files** — C `privacy/app/export-registry.ts`, `privacy/app/export-job.ts`, `privacy/http/export-routes.ts`, tests; each owner module adds `privacy-hooks.ts` (tasks in their areas: identity, families, ledger, budgeting, recurring, ai, comms (T-COMM-20), notifications, shopping, lending, billing).
**Steps**
1. Registry API (exported by `privacy/index.ts`): `registerExportHook(moduleName, fn: (userId) => Promise<ExportSection>)`, `registerEraseHook(moduleName, fn: (userId, ctx) => Promise<EraseReport>)`; `type ExportSection = { name: string; files: { path: string; contentType: "application/json"|"text/csv"; body: string | Buffer }[] }`. Modules call it in `registerModule`. An architecture test asserts every module that owns tables with a `user_id`, `created_by`, `sender_id` or `owner_id` column registers both hooks (lists in `privacy/app/hook-coverage.test.ts`, with an explicit allow-list file for modules that own no personal data such as `platform`).
2. `POST /v1/me/export` → creates a request (409 `export_in_progress` if one is open), enqueues `privacy.export` and returns `202 { requestId, status:"open", dueAt }`. Rate limit 3 per day.
3. Job `privacy.export` `{requestId}`: for each registered hook call with a 60 s timeout; stream files into a ZIP (`archiver`) with this layout: `README.txt` (what the files are, in Bangla and English), `profile.json`, `ledger/transactions.csv`, `ledger/transactions.json`, `comms/messages.json`, …, `manifest.json` (hook names, counts, `generatedAt`, sha256 of each file). Upload to storage key `exports/{userId}/{requestId}.zip`, create `export_files` row with `expires_at = now + 7 days`, set request `done`, publish `privacy.ExportReady.v1 {userId, requestId, downloadAvailableUntil}` (T-NOTIF-07 sends push and inbox with a link).
4. `GET /v1/me/export/:requestId` → `{ status, step, dueAt, downloadUrl?, expiresAt? }` (owner of the request only; the URL is a presigned GET valid 10 minutes and re-issued on each call while the file exists).
5. A job `privacy.export-cleanup` daily deletes expired files.
6. A failing hook marks the section `failed` in `manifest.json`, the job still finishes, and request `meta.failedHooks` lists module names; a second automatic run is enqueued once for failed hooks.
**Contract**
```json
// POST /v1/me/export -> 202
{ "requestId":"…","status":"open","dueAt":"2026-12-11T…" }
// GET /v1/me/export/:id
{ "status":"done","step":"ready","downloadUrl":"https://…","expiresAt":"…" }
```
**Tests** — `export-job.db.test.ts` (MinIO): `zip contains own data from every registered hook`, `contains nothing belonging to another user (sentinel strings of user B absent)`, `manifest hashes match`, `failing hook recorded and rest ok`, `second request while open 409`, `download url only for owner`, `expired file removed`, `ready within 60s in test (AC-27)`; `hook-coverage.test.ts` described above.
**Acceptance** — `pnpm test:db -- privacy/app/export && pnpm test -- privacy/app/hook-coverage`.
**Done when** — AC-27 passes.

### T-PRIV-03 · Erasure state machine (30-day grace)
- **Closes:** FR-PRIV-04, FR-AUTH-05, FR-FAM-07 (owner rule), screen F7, AC-28
- **Depends on:** T-PRIV-01, T-ID (sessions revocation facade `identity.disableUser`), T-FAM (ownership facade)
- **Milestone:** M5 · **Layer:** api
**Why** — Deleting is serious: confirm identity, allow cancel, then erase everywhere.
**Files** — C `privacy/domain/erasure-machine.ts`, `.test.ts`; C `privacy/app/erasure.ts`, `privacy/http/erasure-routes.ts`, `erasure.db.test.ts`; M `privacy/jobs.ts`.
**Steps**
1. States: `requested (disabled, grace running) → executing → done`, or `requested → cancelled`. `step` values for the admin queue: `identity_checked`, `owner_transfer_needed`, `export_offered`, `grace`, `executing`, `confirmation_sent`, `done`.
2. `POST /v1/me/erasure` body `{ confirmLast3: "678" }`: must equal the last 3 digits of the caller's phone (`400 confirm_mismatch`). Preconditions: the user must not be the **only** Owner of a family that has other members (`409 owner_transfer_needed` with `details {families:[{id,name}]}`); an Owner of a family with no other members: the family is scheduled for deletion with the user. On success: create request (`due_at = +30 days`, `grace_until = +30 days`), call `identity.disableUser(userId)` (revokes all sessions, blocks login except the cancel path), publish `privacy.ErasureRequested.v1 {userId, requestId, graceUntil}` (notifies by SMS through `identity` and inbox is unreachable once disabled, so notification kind `erasure_scheduled` is sent by SMS template in T-ID).
3. Cancel: a login attempt by a user with an open erasure request returns tokens flagged `erasurePending: true` limited to `DELETE /v1/me/erasure`, `GET /v1/me`, `POST /v1/auth/logout`; `DELETE /v1/me/erasure` sets request `cancelled` and calls `identity.enableUser`.
4. Job `privacy.erasure-sweep` hourly: for requests with `grace_until <= now` and status `open`: set `in_progress`, and in order: (a) offer-export is skipped if one was done; (b) publish `identity.UserErased.v1 {userId, requestId}` (the identity module owns publishing this after it anonymises its own tables, see T-PRIV-04); (c) wait until every registered erase hook reports completion by writing `privacy.erase_progress(request_id, module, status)` rows (event handlers call `privacy.reportEraseDone(requestId, module, report)`); (d) when all modules are done or after a 6-hour limit mark `done` and record `report` in request `meta` (counts only, no personal data); modules that timed out are retried by a job `privacy.erase-retry` every 30 minutes up to 24 hours, then flagged in system health.
5. Orphaned family handling at execution: `families` handles `UserErased` per FR-FAM-08 (oldest Admin becomes Owner; else oldest Member; else the family is scheduled for deletion in 30 days).
**Contract** — Errors: `confirm_mismatch` (400), `owner_transfer_needed` (409), `erasure_in_progress` (409).
**Tests** — `erasure-machine.test.ts`: transitions and illegal transitions. `erasure.db.test.ts` (fake clock + hooks): `confirm digits required`, `sole owner with members blocked`, `solo owner allowed and family scheduled`, `login disabled during grace but cancel works`, `cancel restores`, `sweep fires after 30 days`, `all hooks reported then done`, `timeouts retried`, `report has counts only`.
**Acceptance** — `pnpm test -- privacy/domain && pnpm test:db -- privacy/app/erasure`.
**Done when** — AC-28 (workflow part) passes with the stub hooks.

### T-PRIV-04 · Erase hooks contract per module
- **Closes:** FR-PRIV-04, AC-28
- **Depends on:** T-PRIV-02, T-PRIV-03
- **Milestone:** M5 · **Layer:** api
**Why** — "Erase" must have an exact meaning in every module. This task defines it and adds a coverage test; each owner implements their hook (listed with the module's own task).
**Files** — C `privacy/app/erase-contract.md` (the table below, kept next to code), C `privacy/app/erase-coverage.db.test.ts`; M each module's `privacy-hooks.ts` (owners: T-ID, T-FAM, T-LED, T-BUD, T-REC, T-AI, T-COMM-20, T-NOTIF, T-SHOP, T-LEND, T-BILL).
**Steps** — Implement and test these exact behaviours; the coverage test creates one user with data in every module, runs erasure, and asserts each row below.

| Module | Delete | Redact or anonymise | Keep |
|---|---|---|---|
| identity | sessions, devices, consents, OTP challenges for the phone | `users` row: phone replaced by `deleted:{uuid}`, name null, locale default | the `users.id` (so foreign ids stay valid) with `erased_at` |
| families | memberships of the user; invites created by or sent to the user | orphan rules FR-FAM-08 | families and other members |
| ledger | merchant rules created by the user; private transactions created by the user; attachments of private ones | `transactions.created_by` and `paid_by_user_id` set to the sentinel id `00000000-0000-0000-0000-000000000000` ("deleted user") for non-private ones | non-private transactions and their amounts |
| budgeting / recurring | nothing | `created_by` sentinel | budgets and templates |
| ai | nothing | `ai_usage` has no user id | summaries (aggregates) |
| comms | messages' bodies (set null), media files, nudges as sender or recipient, conversation memberships, presence | `meta.sender_erased=true` | message ids and order; group conversations |
| notifications | `inbox_items`, `preferences` | — | `delivery_stats` (aggregates) |
| shopping | items added by the user are kept; `added_by` → sentinel | sentinel | lists |
| lending | dhar entries and repayments created by the user | — | entries created by others |
| billing | nothing deleted | `payments.created_by` sentinel | invoices and payments (legal record) |
| privacy | export files | request `meta` keeps counts | request records (no personal data) |
| admin | — | audit entries keep staff ids (not family members); family ids stay | audit log (append-only) |

**Tests** — `erase-coverage.db.test.ts`: `after erasure no row anywhere contains the user's phone, name or sentinel strings seeded in notes/messages`, `each module's report lists counts`, `sentinel id constant exported from shared`.
**Acceptance** — `pnpm test:db -- privacy/app/erase-coverage`.
**Done when** — the table above is true in a seeded database.

### T-PRIV-05 · Retention jobs
- **Closes:** FR-PRIV-06, §5.2 of v0.2, GAP-LED-02 (purge)
- **Depends on:** T-PRIV-01 and the owner modules' purge facades
- **Milestone:** M5 · **Layer:** api
**Why** — Promises in the policy must run by themselves.
**Files** — C `privacy/domain/retention.ts` (constants), `privacy/app/retention-jobs.ts`, `retention-jobs.db.test.ts`; each owner adds `purgeExpired(now)` to its facade: `ledger.purgeDeletedTransactions(before)`, `families.purgeExpiredInvites(before)`, `identity.purgeOtpChallenges(before)`, `notifications.purgeInbox(before)`, `comms` (T-COMM-15, -18).
**Steps**
1. `retention.ts` exports: `SOFT_DELETED_TRANSACTION_DAYS = 30`, `MEDIA_DAYS = 180`, `CALL_LOG_DAYS = 90`, `INBOX_DAYS = 90`, `INVITE_DAYS = 30`, `OTP_HOURS = 24`, `EXPORT_FILE_DAYS = 7`, `AI_LOG_DAYS = 90`.
2. Job `privacy.retention-daily` `0 21 * * *` UTC (03:00 Dhaka) runs each purge in its own try/catch and writes a row to `privacy.retention_runs(id, ran_at, results jsonb)`; failures log and continue.
3. Sync tombstones: ledger purge must keep `deleted_at` rows for **at least** 30 days (SRS §9) and may only purge rows older than 30 days **and** older than the oldest device cursor claim: `sync` records `sync.device_cursors(device_id, family_id, last_seq, updated_at)`; purge ignores devices unseen for 60 days. (Owned by T-SYNC; this task calls `sync.minRetainedSeq(familyId)`.)
4. Expose `GET`-less health data: last run result summary through `privacy.getRetentionStatus()` (`@staff-safe`, counts and timestamps only).
**Tests** — `retention-jobs.db.test.ts` (fake clock): `transaction deleted 29 days ago kept, 31 days purged`, `invite older than 30 days purged`, `otp older than 24h purged`, `inbox 91 days purged`, `one failure does not stop others`, `run recorded`.
**Acceptance** — `pnpm test:db -- privacy/app/retention-jobs`.
**Done when** — all purge rules run and are recorded.

### T-PRIV-06 · Record of processing generator
- **Closes:** FR-PRIV-07, NFR-07
- **Depends on:** T-PRIV-04
- **Milestone:** M5 · **Layer:** api
**Why** — PDPO requires a record of processing; generating it from code keeps it true.
**Files** — C `privacy/domain/processing-registry.ts` (each module registers `{module, dataTypes[], purpose, legalBasis, retention, processors[], crossBorder}` through `registerProcessing`), `scripts/generate-ropa.ts`, output `docs/privacy/record-of-processing.md` (committed), `ropa.test.ts`.
**Steps**
1. Every module calls `registerProcessing` in `registerModule` (a test enforces that every module folder except `platform` registers).
2. Processors list: Anthropic (AI parsing, cross-border, no names or full phones), Firebase Cloud Messaging (push tokens), SMS gateway, S3-compatible storage host, payment gateways, hosting provider; each with country/region from env `HOSTING_REGION` and a fixed string for others.
3. `pnpm privacy:ropa` writes Markdown table sorted by module; CI step `pnpm privacy:ropa && git diff --exit-code docs/privacy` fails if stale.
**Tests** — `ropa.test.ts`: `every module registered`, `retention values equal retention constants`, `AI cross-border flagged`.
**Acceptance** — `pnpm privacy:ropa && git diff --exit-code docs/privacy && pnpm test -- privacy/domain`.
**Done when** — the generated document is committed and current.

### T-PRIV-07 · Breach runbook and checks
- **Closes:** NFR-07 (breach process), SRS §11.4
- **Depends on:** none
- **Milestone:** M5 · **Layer:** docs
**Why** — PDPO requires a breach process; CI proves the document exists and stays complete.
**Files** — C `docs/runbooks/breach.md`, C `scripts/check-runbooks.ts`, M root `package.json` (`"check:runbooks"`), M CI workflow.
**Steps**
1. `breach.md` must contain these level-2 headings in this order: `Detect`, `Contain`, `Assess`, `Notify regulator (72 hours)`, `Notify users`, `Recover`, `Review`, each with numbered steps referencing concrete tooling: audit log queries (`GET /admin/v1/audit`), session revocation (`identity.revokeAllSessions`), key rotation (`JWT_SECRET`, `STAFF_JWT_SECRET`, `TURN_SECRET`), and the exact command `pnpm admin:cli revoke-all-sessions` (created in T-ADM-02).
2. `check-runbooks.ts` verifies headings, that each referenced env var exists in `.env.example`, and that each referenced command exists in `package.json`.
**Tests** — `scripts/check-runbooks.test.ts`: `fails when a heading is missing`, `fails when env var unknown`.
**Acceptance** — `pnpm check:runbooks`.
**Done when** — runbook passes the check in CI.

---

# T-ADM: Admin API

Screens C0–C4 and G1–G4. FR-ADM-01..11, NFR-23, AC-29..AC-31. The admin console UI is T-ADMUI (in `05-web-admin.md`).

### T-ADM-01 · Module and schema
- **Closes:** FR-ADM-01 (storage), FR-ADM-08 (table), GAP-ADM-01
- **Depends on:** platform skeleton
- **Milestone:** M5 · **Layer:** api
**Why** — Staff, sessions and audit entries need their own tables, separate from family users.
**Files** — C `admin/{index.ts,schema.ts,events.ts,jobs.ts}`, `admin/http/routes.ts` (mounted under prefix `/admin/v1`), migration, `schema.db.test.ts`; M `app.ts`.
**Steps**
1. `pgSchema("admin")`: `staff_users(id uuid pk, email citext unique, name text, role text check in ('staff_owner','support','read_only'), password_hash text not null, totp_secret_enc bytea null, totp_enabled boolean default false, failed_attempts int default 0, locked_until timestamptz null, disabled_at timestamptz null, last_login_at timestamptz null, created_by uuid null, created_at)`; `staff_sessions(id uuid pk, staff_id uuid, created_at, last_seen_at, absolute_expires_at, revoked_at null, ip inet, user_agent text)`; `staff_invites(id, email, role, token_hash, expires_at, accepted_at null, created_by)`; `audit_log(id bigserial pk, at timestamptz default now(), staff_id uuid null, action text not null, target_type text not null, target_id text null, family_id uuid null, reason text null, request_id text, details jsonb default '{}', prev_hash char(64) not null, hash char(64) not null)`; trigger `audit_log_no_update` raising an exception on `UPDATE` and `DELETE` (append-only at the database level); index `(at desc)`, `(family_id, at desc)`, `(staff_id, at desc)`.
2. `citext` extension created in the migration.
3. First staff owner is created by `pnpm admin:cli create-owner --email … --name …` (T-ADM-02), which prints a one-time setup link; never by seed data in production.
**Tests** — `schema.db.test.ts`: `email unique case-insensitive`, `audit update fails`, `audit delete fails`, `role check`.
**Acceptance** — `pnpm db:migrate && pnpm test:db -- admin/schema`.
**Done when** — tables exist and the audit table cannot be modified.

### T-ADM-02 · Staff authentication (Argon2id, TOTP, lockout) and CLI
- **Closes:** FR-ADM-01, AC-29, NFR-05, NFR-23
- **Depends on:** T-ADM-01
- **Milestone:** M5 · **Layer:** api
**Why** — Staff accounts are high value; password plus TOTP with lockout is the minimum.
**Files** — C `admin/domain/password.ts`, `admin/domain/totp.ts`, `admin/app/staff-auth.ts`, `admin/http/auth-routes.ts`, `admin/cli.ts` (`pnpm admin:cli`), tests; M `apps/api/package.json` (`argon2`, `otplib` or a small RFC 6238 implementation in `totp.ts` with tests); env `STAFF_JWT_SECRET` (≥ 32 chars, different from `JWT_SECRET`), `STAFF_TOTP_ENC_KEY` (32 bytes base64, AES-256-GCM for secrets at rest).
**Steps**
1. Password: Argon2id (`memoryCost 19456 KiB, timeCost 2, parallelism 1`), min 12 characters, reject the top-1000 common passwords list (`admin/domain/common-passwords.txt`).
2. TOTP: RFC 6238, SHA-1, 6 digits, 30 s step, accept ±1 step, prevent replay by storing `last_totp_step` per staff and rejecting a reused step.
3. Flow: `POST /admin/v1/auth/login {email, password}` → `200 { challengeId, totpRequired: true }` (or `{ totpSetupRequired: true, otpauthUri, challengeId }` on first login after invite) → `POST /admin/v1/auth/totp {challengeId, code}` → `200 { token, expiresAt }` and sets session. Wrong password or code increments `failed_attempts`; at 5 failures `locked_until = now + 15 min` (`423 account_locked` with `retryAfterSeconds`); success resets. Responses for unknown email are identical in shape and timing (dummy hash verify).
4. `POST /admin/v1/auth/logout`, `GET /admin/v1/me` (name, role, permissions list).
5. Invite acceptance: `POST /admin/v1/auth/accept-invite {token, password}` sets the password and starts TOTP setup.
6. TOTP reset by a Staff Owner: `POST /admin/v1/staff/:id/reset-totp` (audited, T-ADM-11).
7. CLI `pnpm admin:cli` commands: `create-owner`, `revoke-all-sessions` (also revokes family sessions through `identity.revokeAllSessions` for breach response), `verify-audit` (T-ADM-04), `unlock --email`.
**Contract** — Errors: `invalid_credentials` (401), `invalid_code` (401), `account_locked` (423), `totp_replayed` (401).
**Tests** — `password.test.ts`: `hash and verify`, `rejects short and common passwords`. `totp.test.ts`: RFC 6238 test vectors, `window ±1`, `replay rejected`. `staff-auth.db.test.ts`: `login without totp not allowed`, `5 wrong attempts lock for 15 minutes (fake clock)`, `unknown email same response shape`, `lock expires`, `success resets counter`, `secrets stored encrypted (raw column does not contain base32 secret)`.
**Acceptance** — `pnpm test -- admin/domain && pnpm test:db -- admin/app/staff-auth`; `pnpm admin:cli create-owner --email test@example.test --name Test --print-link` exits 0 in CI.
**Done when** — AC-29 (API part) passes.

### T-ADM-03 · Staff JWT, session rules and route guards
- **Closes:** FR-ADM-01, SRS §11.1, AC-29
- **Depends on:** T-ADM-02
- **Milestone:** M5 · **Layer:** api
**Why** — A staff token must never work on family routes and vice versa; sessions idle out.
**Files** — C `admin/http/guards.ts` (`requireStaff(minRole)`, `requirePermission(name)`), `admin/domain/permissions.ts`, `guards.db.test.ts`.
**Steps**
1. Staff JWT: `aud: "admin"`, `iss: "amar-poribar"`, claims `sub`, `sid`, `role`; signed with `STAFF_JWT_SECRET`; lifetime 30 minutes sliding: each authenticated request with `now - last_seen_at > 5 min` re-issues a token in header `x-staff-token` and updates `last_seen_at`; idle > 30 min or `absolute_expires_at` (8 h) → `401 session_expired`.
2. The family `app.authenticate` rejects tokens with `aud=admin` (`401`); `requireStaff` rejects tokens without it.
3. Permission matrix in `permissions.ts`:

| Permission | staff_owner | support | read_only |
|---|---|---|---|
| `families.view` | ✓ | ✓ | ✓ |
| `families.change_plan` | ✓ | ✓ | |
| `families.adjust_quota` | ✓ | ✓ | |
| `families.suspend` | ✓ | ✓ | |
| `families.transfer_ownership` | ✓ | ✓ | |
| `families.delete` | ✓ | | |
| `privacy.handle` | ✓ | ✓ | |
| `audit.view` | ✓ | ✓ | ✓ |
| `staff.manage` | ✓ | | |
| `plans.edit` | ✓ | | |
| `health.view` | ✓ | ✓ | ✓ |

4. All `/admin/v1` routes except `/auth/*` use `requireStaff` and a permission check; failures are `403 forbidden` and are written to the audit log as `auth.denied`.
**Tests** — `guards.db.test.ts`: `family token on admin route 401`, `staff token on /v1 route 401`, `idle timeout 30m (fake clock)`, `absolute 8h`, `read_only cannot suspend 403 and audited`, `sliding refresh header`.
**Acceptance** — `pnpm test:db -- admin/http/guards`.
**Done when** — token audiences are isolated.

### T-ADM-04 · Audit log with hash chain and verification
- **Closes:** FR-ADM-08, NFR-23, AC-30
- **Depends on:** T-ADM-01
- **Milestone:** M5 · **Layer:** api
**Why** — Tamper evidence for staff actions.
**Files** — C `admin/domain/audit-hash.ts`, `admin/app/audit.ts`, `admin/http/audit-routes.ts`, `admin/cli.ts` (`verify-audit`), tests.
**Steps**
1. `appendAudit(tx, entry)`: inside a transaction take an advisory lock (`pg_advisory_xact_lock(hashtext('admin.audit'))`), read the last `hash` (or 64 zeros), compute `hash = sha256(prev_hash + canonicalJson({at, staff_id, action, target_type, target_id, family_id, reason, request_id, details}))`, insert.
2. Every state-changing admin route calls `appendAudit` in the same transaction as the change; denials and logins also append.
3. `GET /admin/v1/audit?staffId=&action=&familyId=&from=&to=&cursor=&limit=` (permission `audit.view`); `GET /admin/v1/audit/export.csv` (same filters; CSV columns exclude `details`).
4. `verifyAuditChain({from?, to?})` recomputes hashes in order; returns `{ ok, checked, firstBadId? }`. CLI `pnpm admin:cli verify-audit` exits 1 when not ok. A job `admin.audit-verify` daily `15 21 * * *` UTC records the result in `platform` health state (read by T-ADM-12).
5. `details` must not contain family-private fields: `appendAudit` runs `assertNoPrivateFields(details)` (list in `packages/shared/src/private-fields.ts`).
**Tests** — `audit-hash.test.ts`: `deterministic canonical json`, `chain links`. `audit.db.test.ts`: `concurrent appends keep a single chain (20 parallel)`, `verify detects a modified row (disable trigger in test to tamper)`, `details with private field throws`, `filters work`, `export csv has no details column`.
**Acceptance** — `pnpm test -- admin/domain && pnpm test:db -- admin/app/audit && pnpm admin:cli verify-audit` (on the seeded test db).
**Done when** — AC-30 hash-chain part passes.

### T-ADM-05 · `@staff-safe` facades and the boundary lint rule
- **Closes:** DEC-18, FR-ADM-11, SRS §11.3, NFR-21
- **Depends on:** T-ADM-01
- **Milestone:** M5 · **Layer:** api
**Why** — The admin module may only see aggregates. This task defines the interfaces and makes the build fail when they leak.
**Files** — C `packages/shared/src/private-fields.ts` (exported array `PRIVATE_FIELD_NAMES`: `amountPaisa`, `feePaisa`, `note`, `counterparty`, `trxId`, `body`, `mediaId`, `phone`, `personName`, `personPhone`, `text`, `preview`, `storageKey`, `fcmToken`, `categoryName` is allowed, `displayName` is **not** returned to staff except as masked initials), C `eslint-rules/staff-safe.js` (custom rule), M `.eslintrc`/`eslint.config.js`, C `admin/app/facade-contract.ts`, stubs in owner modules.
**Steps**
1. Define these facade functions (each in its owner's `index.ts`, JSDoc tag `@staff-safe`, return type contains no private field names):
   - `families.listFamiliesForAdmin(filter: {q?, plan?, status?, quotaOver?, cursor?, limit}) : {items: AdminFamilyRow[], nextCursor}` where `AdminFamilyRow = {familyId, name, ownerPhoneMasked, memberCount, planId, aiUsed, aiQuota, lastActiveAt, status: 'active'|'no_owner'|'dormant'|'suspended'}`.
   - `families.getFamilyForAdmin(familyId): {…row, createdAt, members:[{userId, initials, role, phoneMasked}], pendingInviteCount}`.
   - `families.adminSuspend(familyId, reason, staffId)`, `adminUnsuspend`, `adminTransferOwnership(familyId, toUserId)`, `adminScheduleDeletion(familyId)` (state changes returned as `{ok:true}`).
   - `billing.getFamilyBilling(familyId)`, `billing.adminChangePlan(familyId, planId, interval?)`, `billing.adminSetQuotaOverride(familyId, extraEntries, reason)`, `billing.getPlanStats()`.
   - `ai.getUsageSummary(familyId, month)`, `ai.getCostSummary(month)` returning `{requests, inputTokens, outputTokens, costPaisa, perActiveFamilyPaisa}`.
   - `comms.getCommsCounts` (T-COMM-20), `lending.getLendingCounts`, `shopping.getShoppingCounts`, `ledger.getLedgerCounts(familyId)` (`{transactionCountLast30d}` only).
   - `privacy.listRequestsForAdmin`, `privacy.adminAdvance(requestId, step)`, `privacy.adminReject(requestId, reason)` returning masked person data.
   - `notifications.getDeliveryHealth(range)`, `identity.getOtpHealth(range)`, `platform.getSystemHealth()`.
2. ESLint rule `staff-safe/only-staff-safe-imports`: in files under `modules/admin/**`, an import from `modules/<x>/index.ts` may only use symbols whose declaration has the `@staff-safe` JSDoc tag (resolved with the TypeScript type checker through `typescript-eslint` parser services). Any other import fails lint.
3. ESLint rule `staff-safe/no-private-fields`: for functions tagged `@staff-safe`, the return type (resolved) must not contain property names in `PRIVATE_FIELD_NAMES`; nested objects and arrays are walked.
4. Unit tests for the rules with `RuleTester` (valid and invalid snippets).
**Contract** — Types in `admin/app/facade-contract.ts` re-export the DTO types so the console gets them via OpenAPI.
**Tests** — `eslint-rules/staff-safe.test.js`: `import of non tagged symbol fails`, `tagged symbol passes`, `return type with amountPaisa fails`, `masked phone string ok`.
**Acceptance** — `pnpm lint && pnpm test -- eslint-rules && pnpm arch`.
**Done when** — the rules run in CI and the stubs exist.

### T-ADM-06 · Overview endpoint
- **Closes:** FR-ADM-02, screen C1
- **Depends on:** T-ADM-03, T-ADM-05
- **Milestone:** M5 · **Layer:** api
**Why** — The first screen staff see.
**Files** — C `admin/app/overview.ts`, `admin/http/overview-routes.ts`, `overview.db.test.ts`.
**Steps**
1. `GET /admin/v1/overview?days=30` (permission `families.view`) returns:
```json
{ "asOf":"2026-11-11T04:00:00Z", "windowDays":30,
  "activeFamilies": 1284, "activeFamiliesChange": 86,
  "avgMembersPerFamily": 3.1, "avgMembersGoal": 2.5,
  "aiCostPerActiveFamilyPaisa": 1140, "aiCostGoalPaisa": 1500,
  "openPrivacyRequests": 3, "oldestOpenPrivacyDays": 12,
  "attention": [ {"kind":"quota_90","count":7,"link":"/families?quotaOver=90"},
                 {"kind":"otp_failures","rate":0.042,"normalMax":0.015},
                 {"kind":"no_owner","count":2,"link":"/families?status=no_owner"} ],
  "newFamiliesPerWeek": [ {"weekStart":"2026-09-14","count":40}, … 8 items ] }
```
2. "Active family" = at least one ledger or comms action in the window (facade counts: `families.countActiveFamilies(days)` defined in T-ADM-05 stubs and implemented by owners; if comms/ledger data is missing the count falls back to ledger only).
3. Cache 60 s in memory.
**Tests** — `overview.db.test.ts`: `numbers match seeded fixture`, `goal fields present`, `attention list ordering`, `permission required`.
**Acceptance** — `pnpm test:db -- admin/app/overview`.
**Done when** — endpoint returns the documented shape.

### T-ADM-07 · Families list and family detail
- **Closes:** FR-ADM-03, FR-ADM-04 (read part), screens C2, C3
- **Depends on:** T-ADM-05
- **Milestone:** M5 · **Layer:** api
**Why** — Staff look up families without seeing money or messages.
**Files** — C `admin/app/families.ts`, `admin/http/families-routes.ts`, `families.db.test.ts`.
**Steps**
1. `GET /admin/v1/families?q=&plan=&status=&quotaOver=90&sort=lastActive|name|members&order=&cursor=&limit=` (limit ≤ 100). `q` matches family name (ILIKE) or the **last 3–6 digits** of the owner phone (min 3 digits; never the whole number). Response items are `AdminFamilyRow`.
2. `GET /admin/v1/families/:familyId` returns `AdminFamilyDetail`: row + members (initials, role, masked phone `•••678`), plan and quota with usage, counts (`ledger`, `comms`, `lending`, `shopping` counters), last 5 staff actions on this family from the audit log, `pendingInviteCount`.
3. `GET /admin/v1/families.csv` exports the list with the same filters (columns: familyId, name, memberCount, planId, aiUsed, aiQuota, status, lastActiveAt).
4. Viewing a family detail appends audit `family.viewed` (throttled: one entry per staff per family per 10 minutes).
**Tests** — `families.db.test.ts`: `search by name`, `search by last digits only`, `7 digit full number rejected as q`, `filters`, `pagination`, `detail masks phones`, `audit entry on view but throttled`, `no private field in response (uses the crawler helper from T-ADM-13)`.
**Acceptance** — `pnpm test:db -- admin/app/families`.
**Done when** — list and detail return aggregates only.

### T-ADM-08 · Family actions with reason and typed confirmation
- **Closes:** FR-ADM-04, FR-ADM-06, AC-30, screen C3
- **Depends on:** T-ADM-04, T-ADM-07
- **Milestone:** M5 · **Layer:** api
**Why** — Risky actions must be deliberate and traceable.
**Files** — C `admin/app/family-actions.ts`, `admin/http/family-action-routes.ts`, `family-actions.db.test.ts`; M `packages/shared/src/schemas/admin.ts`.
**Steps**
1. Common body: `{ reason: string (10–500 chars, trimmed) }`; destructive actions (`suspend`, `delete`) also require `confirmFamilyName` equal (exact, case-sensitive) to the family name; mismatch `400 confirm_mismatch`.
2. Routes (all `POST /admin/v1/families/:familyId/…`, each runs in one transaction with `appendAudit`):
   - `plan` `{ planId, interval? , reason }` → `billing.adminChangePlan` (permission `families.change_plan`).
   - `quota` `{ extraEntries: 1..1000, reason }` → override added to `family_overrides` (permission `families.adjust_quota`).
   - `suspend` `{ reason, confirmFamilyName }` → `families.adminSuspend` (publishes `families.FamilySuspended.v1`).
   - `unsuspend` `{ reason }`.
   - `transfer-ownership` `{ toUserId, reason }` (target must be a current member).
   - `delete` `{ reason, confirmFamilyName }` → `families.adminScheduleDeletion` (30-day grace through the privacy workflow; Staff Owner only).
3. Errors: `reason_required` (400), `confirm_mismatch` (400), `forbidden` (403), `not_found`, `invalid_state` (409, e.g. suspending a suspended family).
4. The audit entry stores `action = "family.suspend"` etc., `reason`, and `details` with only non-private values (planId, extraEntries, toUserId masked).
**Tests** — `family-actions.db.test.ts`: `no reason rejected`, `9 char reason rejected`, `delete without confirmFamilyName rejected`, `wrong name rejected`, `suspend blocks comms send (cross-check 423)`, `unsuspend restores`, `plan change updates entitlements`, `quota override adds entries`, `transfer to non member 404`, `support cannot delete 403`, `each success appends one audit row with reason and verifies chain`.
**Acceptance** — `pnpm test:db -- admin/app/family-actions`.
**Done when** — AC-30 action part passes.

### T-ADM-09 · Privacy request queue
- **Closes:** FR-ADM-05, screen C4
- **Depends on:** T-ADM-05, T-PRIV-03
- **Milestone:** M5 · **Layer:** api
**Why** — Staff must finish requests inside 30 days.
**Files** — C `admin/app/privacy-queue.ts`, `admin/http/privacy-routes.ts`, tests.
**Steps**
1. `GET /admin/v1/privacy-requests?status=open|done|rejected&kind=` → items `{ id, kind, personPhoneMasked, familyName?, receivedAt, dueAt, daysLeft, severity: "normal"|"warning"|"urgent", step, status }` with `severity = urgent` when `daysLeft ≤ 5`, `warning` when `≤ 10`; counts per status in `counts`.
2. `GET /admin/v1/privacy-requests/:id` → items with checklist `steps: [{key, label, state: done|waiting|todo}]` (identity_checked, owner_transfer_needed, export_offered, erase_data, confirmation_sent) derived from `privacy.requests` and `erase_progress`.
3. `POST …/:id/advance` `{ step, reason }` (only allowed transitions: e.g. mark `export_offered`, trigger `executing` if grace ended or the user asked for immediate erase and grace is waived); `POST …/:id/reject` `{ reason }` (≥ 10 chars) sets `rejected`, notifies user by SMS template. Both audited; permission `privacy.handle`.
4. Staff cannot trigger `erase_data` before `grace_until` unless the request carries `meta.graceWaived=true`, which only the **user** can set (`POST /v1/me/erasure {confirmLast3, waiveGrace:true}` allowed in T-PRIV-03 only when the user types the phone digits twice; add the parameter there if missing).
**Tests** — `privacy-queue.db.test.ts`: `severity buckets (11, 10, 5, 4 days)`, `masked phone`, `advance audited`, `reject needs reason`, `staff cannot erase during grace`, `read_only cannot advance 403`.
**Acceptance** — `pnpm test:db -- admin/app/privacy-queue`.
**Done when** — the queue works end to end with the fake clock.

### T-ADM-10 · Plans and AI quota administration
- **Closes:** FR-ADM-07, screen G1
- **Depends on:** T-BILL-01, T-BILL-02, T-ADM-05
- **Milestone:** M8 (but the read endpoints in M5) · **Layer:** api
**Why** — Staff tune limits and watch AI cost against the ৳15 goal.
**Files** — C `admin/app/plans.ts`, `admin/http/plans-routes.ts`, tests.
**Steps**
1. `GET /admin/v1/plans` → catalogue with `familyCount` per plan, `aiCostPerFamilyPaisa`, `nearQuotaCount` (families ≥ 90% of their quota).
2. `PUT /admin/v1/plans/:planId` `{ priceMonthPaisa?, priceYearPaisa?, limits: {key: value}, reason }` (permission `plans.edit`, audited); validation: limits keys known, ints ≥ 0; changes apply to new periods only (existing subscriptions keep their period; entitlements read live limits).
3. `GET /admin/v1/ai/near-quota?threshold=90&cursor=` list of families (row type) near quota.
4. `GET /admin/v1/ai/cost?months=6` series `{month, requests, costPaisa, activeFamilies, perActiveFamilyPaisa}` with goal 1500 for the chart.
**Tests** — `plans.db.test.ts`: `limits edit audited`, `unknown key 400`, `entitlements reflect change`, `near quota list`, `read_only cannot edit`.
**Acceptance** — `pnpm test:db -- admin/app/plans`.
**Done when** — G1 data is served.

### T-ADM-11 · Staff management
- **Closes:** FR-ADM-09, screen G3
- **Depends on:** T-ADM-02, T-ADM-03
- **Milestone:** M5 · **Layer:** api
**Why** — Staff Owners add and remove staff and see who has 2FA.
**Files** — C `admin/app/staff.ts`, `admin/http/staff-routes.ts`, tests.
**Steps**
1. `GET /admin/v1/staff` (permission `staff.manage`) → `{ items: [{id, name, email, role, totpEnabled, lastLoginAt, status: 'active'|'invited'|'disabled'|'locked'}], matrix }` where `matrix` is the permission table from T-ADM-03 for display.
2. `POST /admin/v1/staff/invites {email, role, reason}` → creates invite (7 days), sends email through the `Mailer` port (add `platform/mailer.ts` port with SMTP adapter `SMTP_URL` and a fake that records messages; tests read the fake); returns `{ inviteId, expiresAt }` (never the token).
3. `PATCH /admin/v1/staff/:id {role?, disabled?}` (cannot change or disable yourself, cannot remove the last active `staff_owner`: `409 last_owner`); disabling revokes sessions. `POST …/:id/reset-totp` clears the secret and forces setup on next login; `POST …/:id/unlock`.
4. All actions audited with `reason` (≥ 10 chars).
**Tests** — `staff.db.test.ts`: `invite email recorded in fake mailer with token link`, `token hashed in db`, `cannot demote last owner`, `cannot disable self`, `disable revokes sessions`, `reset totp forces setup`, `support cannot manage 403`, `expired invite rejected`.
**Acceptance** — `pnpm test:db -- admin/app/staff`.
**Done when** — all staff operations are audited and guarded.

### T-ADM-12 · System health aggregator
- **Closes:** FR-ADM-10, NFR-04, NFR-08, NFR-12, screen G4
- **Depends on:** T-ADM-05, T-NOTIF-05 (delivery stats), platform metrics
- **Milestone:** M5 · **Layer:** api
**Why** — Staff must see problems before families report them.
**Files** — C `admin/app/health.ts`, `admin/http/health-routes.ts`, `health.db.test.ts`; C `platform` (owner T-PLAT) exposes `getSystemHealth()` with the fields below; `identity.getOtpHealth` and `notifications.getDeliveryHealth` as in T-ADM-05.
**Steps**
1. `GET /admin/v1/health?range=24h|7d` returns:
```json
{ "asOf":"…",
  "api": { "availabilityPct": 99.93, "targetPct": 99.5, "p95LatencyMs": 182, "errorRatePct": 0.2 },
  "otp": { "deliveryRatePct": 95.8, "normalMinPct": 98.5, "provider":"sslwireless", "providerStatus":"degraded" },
  "push": { "deliveryRatePct": 97.2, "unregisteredTokensRemoved": 31 },
  "sms": { "status":"ok" },
  "ai": { "errorRatePct": 1.1, "templateFallbackRatePct": 6.4, "costPerActiveFamilyPaisa": 1140 },
  "jobs": { "queueDepth": 12, "failedLast24h": 0, "deadLetters": 0 },
  "backups": { "lastBackupAt":"…", "lastRestoreTestAt":"…", "lastRestoreTestOk": true },
  "audit": { "lastVerifyOk": true, "lastVerifyAt":"…" },
  "retention": { "lastRunAt":"…", "failures": 0 },
  "media": { "familiesOverStorageAlarm": 0 },
  "incidents": [ { "at":"…", "severity":"warning", "title":"OTP delivery below normal", "status":"open" } ] }
```
2. Incidents are rows in `platform.health_incidents` created by threshold rules evaluated by job `admin.health-evaluate` every 5 minutes: OTP delivery < 98.5%, push delivery < 95%, API p95 > 300 ms, dead letters > 0, last backup older than 26 h, restore test older than 8 days, audit verify failed, media alarm. Each rule opens an incident once and resolves it when healthy.
3. Backup and restore-test timestamps are read from `platform.job_state` rows written by T-PLAT's backup and restore-test jobs (the aggregator never touches backup tools).
4. No PII anywhere in the payload.
**Tests** — `health.db.test.ts`: `shape matches schema (zod)`, `incident opens once and resolves`, `OTP threshold rule`, `stale backup rule`, `no PII (crawler helper)`, `read_only can view`.
**Acceptance** — `pnpm test:db -- admin/app/health`.
**Done when** — G4 data is served and incidents behave.

### T-ADM-13 · Staff data boundary crawler (AC-31) and admin contract in CI
- **Closes:** FR-ADM-11, NFR-23, SRS §11.3, AC-31
- **Depends on:** T-ADM-06..12
- **Milestone:** M5 · **Layer:** api
**Why** — Proves that no admin response leaks private data, automatically, for every present and future admin route.
**Files** — C `apps/api/src/security/staff-boundary.test.ts`, C `tools/fixtures/sentinel-family.ts`, C `admin/test-helpers/crawler.ts` (used by other admin tests).
**Steps**
1. Fixture: seed a family with sentinel strings in every private field: transaction `note` = `SENTINEL_NOTE_7f3a`, counterparty, trxId, message body (`SENTINEL_MSG_…`), voice media id, dhar person name, shopping item name, user display names (`SENTINEL_NAME_…`), full phone numbers (`+8801700000001` …), FCM tokens, storage keys.
2. Crawler: read `openapi.json`, list every `GET /admin/v1/**` route; fill path params from the fixture (family id, request id, staff id); call each with a Staff Owner token (and with Read-only for the permitted routes); also call each `POST` action in dry-run mode with valid bodies where the response body is checked (actions run inside a rolled-back transaction fixture).
3. Assert: no response body, header, CSV export or audit entry contains any sentinel string or a full phone number (regex `\+?8801\d{9}`), and phones appear only as `•••` plus 3 digits.
4. Assert every route in the OpenAPI document under `/admin/v1` is covered (the test fails when a new admin route has no fixture mapping, with a message naming the route).
5. Add the crawler to `pnpm verify:m5`.
**Contract** — Sentinel list is exported from `packages/shared/src/private-fields.ts` as `SENTINEL_PREFIXES` for reuse.
**Tests** — the crawler itself; plus a negative test that deliberately adds a leaking fake route in a test app and expects the crawler to fail (`staff-boundary.negative.test.ts`).
**Acceptance** — `pnpm test:db -- security/staff-boundary` exit 0; negative test exit 0 (it asserts failure is detected).
**Done when** — AC-31 passes and new admin routes are covered automatically.

---

## Task count and checklist

| Area | Tasks |
|---|---|
| T-NOTIF | 8 (01–08) |
| T-COMM | 20 (01–20) |
| T-SHOP | 3 |
| T-LEND | 3 |
| T-BILL | 8 |
| T-PRIV | 7 |
| T-ADM | 13 |
| **Total** | **62** |

Acceptance coverage: AC-15, -16 (COMM-09), AC-17 server part (COMM-09/10), AC-18 (COMM-05), AC-19 (COMM-07), AC-20, -21 (COMM-13/14), AC-22 (COMM-12), AC-27 (PRIV-02), AC-28 (PRIV-03/04), AC-29 (ADM-02/03), AC-30 (ADM-04/08), AC-31 (ADM-13), AC-32 server part (COMM-16/17), AC-33 (COMM-18), AC-34 server support (COMM-17/19), AC-37 (SHOP-02/03), AC-39 (BILL-06), AC-40 (BILL-07), AC-41 (LEND-02).
