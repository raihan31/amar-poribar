# Amar Poribar — Software Requirements Specification (SRS)

| Item | Value |
|---|---|
| Version | 1.0. Replaces v0.2 |
| Date | 2026-11-11 |
| Based on | [BRD v0.3](./BRD.md), the design canvas "Family Connect Design" (52 screens), and a code review of the repository at commit `e2ef7bc` |
| Design reference | https://claude.ai/artifact/4h5SPurNz7kAb1oJQdozwW (screen codes such as `D4` or `G2` are used throughout) |
| Structure | Adapted from IEEE 830 / ISO/IEC/IEEE 29148 |
| Design files | [docs/design/screens/](./design/screens/) (the 52 boards as HTML) |
| Task backlog | [docs/tasks/](./tasks/README.md) (one file per area, every task has automated acceptance checks) |

### What changed since v0.2

1. **Family communication** is now a product pillar: buzz (vibration nudge), text chat, voice notes, video messages and video calls (§4.12).
2. **Backend is a modular monolith** (§3). One deployable, strict module boundaries, in-process events, one database with a schema per module.
3. **Admin console** for platform staff (§4.17).
4. New product areas taken from the design: shared bazaar list (§4.13), dhar (lent/borrowed) tracker (§4.14), plans and payment (§4.15), privacy workflows (§4.16), Simple mode and first-run flow (§4.18), notifications inbox, family switching, offline status.
5. **Implementation gap register** (§12) from reading the whole repository. It corrects two claims in v0.2: server sync (FR-SYNC-05) **is** built, and the API already has receipts, Ask, recurring bills, festival budgets, remittance reports and CSV export.
6. **Autonomous delivery rules** (§1.5): no human approval or manual testing steps anywhere in the delivery process.

---

## 1. Introduction

### 1.1 Purpose
This SRS specifies Amar Poribar, a family expense tracker and family communication app for Bangladesh. It is written for developers, automated coding agents, testers and the product owner. Every requirement has an ID, a phase and, where the design shows it, a screen code. Every requirement can be checked by an automated test.

### 1.2 Scope
Five deliverables in one monorepo:

| Deliverable | Path | Stack |
|---|---|---|
| REST + WebSocket API (modular monolith) | `apps/api` | Node.js 22, Fastify 5, Drizzle ORM, PostgreSQL 16, pg-boss |
| Family web app | `apps/web` | Next.js (App Router), React |
| Admin console (staff only) | `apps/admin` (new) | Next.js (App Router), English UI |
| Android app (iOS later) | `apps/mobile` | Flutter 3 / Dart 3, Riverpod, Drift (SQLite), `flutter_webrtc` |
| Shared TypeScript packages | `packages/shared`, `packages/ai` | Zod schemas, money and Bangla formatting, i18n, SMS and AI parsers |

The Flutter app cannot import the TypeScript packages. It mirrors the API contract through a generated OpenAPI document (§5.3) and shared test vectors.

Phases: P1 = MVP, P2 = v1, P3 = growth (BRD §5). Priority: **M** must, **S** should, **C** could.

### 1.3 Definitions
See BRD §12. In addition:
- **Family**: the workspace (tenant). Every family-owned record belongs to exactly one family.
- **Buzz / nudge**: a short vibration and spoken phrase sent from one member to another to remind or call them.
- **Module**: a bounded part of the backend with its own code folder, database schema, public facade and events (§3).
- **Facade**: the only file other modules may import from a module (`modules/<name>/index.ts`).
- **Staff**: Amar Poribar employees who use the admin console. They are not family members.
- **Draft**: an AI- or parser-generated transaction waiting for confirmation.
- **Paisa**: 1/100 of a taka. All money is an integer number of paisa.
- **HLC**: hybrid logical clock used to merge ledger changes (FR-SYNC-02).
- **Screen code**: the label of a design board, for example `A3` (voice entry read-back).

### 1.4 References
- BRD v0.3 (`docs/BRD.md`)
- Personal Data Protection Ordinance 2025 (Bangladesh)
- Google Play policies: SMS and Call Log permissions, full-screen intent, foreground services
- Anthropic Claude API documentation
- Firebase Cloud Messaging HTTP v1 API; WebRTC (RFC 8825 family); coturn REST API for ephemeral credentials

### 1.5 Autonomous delivery rules (no human gates)
These rules apply to everything built from this document.

1. **CI is the only gate.** A change merges when CI passes. No manual QA, sign-off, design review, or product-owner approval is part of the delivery process.
2. **Decisions are already made.** Choices that would normally need a meeting are recorded in §2.6 (decision log). A task never ends with "ask the owner". If something is unclear, the SRS rule wins; if the SRS is silent, pick the simplest option that satisfies the nearest requirement and record it in the pull request description and the decision log.
3. **Every task has machine-checkable acceptance criteria**: a command that exits 0, a test that passes, a file that exists, a metric threshold. Criteria that need a person's judgement are not allowed.
4. **Everything runs without third parties in CI and local development.** Each external service (SMS gateway, FCM, S3, TURN, payment gateways, Claude) has an adapter interface and an in-memory or containerised fake. Production adapters are selected by environment variables.
5. **Feature flags instead of approvals.** Unfinished features ship dark behind flags in the `platform` module (§3.6) and are switched on by configuration.
6. **Usability checks are automated proxies**: touch-target size, contrast, label coverage, string coverage, screen-reader tree tests, and golden screenshots compared against the design tolerances. Real-user usability testing (BO-8) is a post-launch measurement, not a release gate.
7. **Migrations, seeds and environment files are generated and committed** so a fresh clone reaches a working stack with `pnpm install && docker compose up`.

---

## 2. Overall description

### 2.1 Product perspective

```
                ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
                │  apps/mobile  │ │   apps/web    │ │  apps/admin   │
                │  Flutter      │ │   Next.js     │ │  Next.js      │
                └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
          HTTPS JSON + WebSocket (JWT)    │      HTTPS JSON (staff JWT + TOTP)
                        └─────────┬───────┴─────────────────┘
                         ┌────────▼──────────────────────────────┐
                         │ apps/api — ONE deployable (monolith)  │
                         │ identity · families · ledger ·        │
                         │ budgeting · recurring · ai · reporting│
                         │ sync · comms · notifications ·        │
                         │ shopping · lending · billing ·        │
                         │ privacy · admin · platform            │
                         └──┬──────┬───────┬────────┬────────┬───┘
                            │      │       │        │        │
                     PostgreSQL  S3-compatible   FCM     coturn    Claude API
                     (+ pg-boss)   storage     (push)  (TURN/STUN)  SMS gateway
                                                              bKash / Nagad / SSLCommerz
```

Clients never call Claude, S3 with long-lived keys, or payment gateways directly. The API signs short-lived URLs and tokens for them.

### 2.2 User classes

**Family roles** (unchanged from v0.2, applied per family):

| Role | Ledger permissions | Communication permissions |
|---|---|---|
| Owner | Everything, including delete family, billing, transfer ownership | All |
| Admin | Members, budgets, categories, accounts; edit all transactions | All |
| Member | Add transactions; edit own; see family transactions except others' private ones | All |
| Viewer | Read-only summaries (no individual transactions) | Can chat, send and receive buzz, voice and video (BR-13: the family member abroad stays connected) |

**Platform staff roles** (admin console only):

| Role | Permissions |
|---|---|
| Staff Owner | Everything, including staff management and plan catalogue |
| Support | View aggregates, change plan and quota, suspend/unsuspend, handle privacy requests, transfer ownership |
| Read-only | View aggregates and audit log only |

Staff never see transactions, notes, chat messages, voice notes, videos, or full phone numbers (§11.3).

### 2.3 Operating environment
- Android 8.0+ (API 26+), 2 GB RAM. Release APK under 35 MB (was 30 MB; WebRTC adds weight).
- Browsers: Chrome, Edge, Safari, Firefox (last 2 versions), 360 px width and up.
- Server: Node.js 22 LTS, PostgreSQL 16+, Linux containers. A single API container is enough for up to 5,000 active families (NFR-04).
- Mobile data: most users are on prepaid 4G. Calls and media must degrade gracefully (§8.5).

### 2.4 Design and implementation constraints
- TypeScript strict mode in all TypeScript workspaces; pnpm workspaces and Turborepo. Mobile is Dart 3 outside the pnpm workspace.
- **The backend is a modular monolith** (§3). Module rules are enforced by CI, not by convention.
- Money is an integer number of paisa; never a float in storage, API or client state.
- All timestamps are UTC in storage and shown in `Asia/Dhaka`.
- No `READ_SMS` permission. SMS comes in by paste or share.
- Every AI-generated record needs explicit confirmation before it is final.
- Device speech recognition and text-to-speech stay on the device (FR-VOICE-01). Voice **notes** (FR-VNOTE) are different: they are recordings the user chooses to send, stored on the server, and the app says so before the first one.

### 2.5 Assumptions
See BRD §10, plus:
- Most users have Google Play Services (needed for FCM). Without it, the app still works in the foreground and falls back to polling every 60 seconds (FR-NOTIF-08).
- Phones allow notification and microphone permission. Camera permission is only asked when a video feature is first used.

### 2.6 Decision log
Decisions that remove the need to ask anyone. Each can be changed only by editing this table in a pull request that also updates the affected tasks.

| ID | Decision | Reason |
|---|---|---|
| DEC-01 | Backend is a **modular monolith**: one process, folders `apps/api/src/modules/<name>`, boundaries enforced with `dependency-cruiser` and an architecture test | Small team, one deploy, but clear seams for later extraction |
| DEC-02 | **One PostgreSQL database, one Postgres schema per module** (`identity`, `families`, `ledger`, …). No foreign keys across schemas. Cross-module data access only through facades or events | Keeps data ownership explicit; allows later split |
| DEC-03 | **Events**: typed in-process event bus plus a transactional outbox (`platform.outbox`) for durable handlers | Modules react to each other without importing each other; no lost events on crash |
| DEC-04 | **Background jobs and schedules**: `pg-boss` on the same PostgreSQL. No Redis | One less service to run |
| DEC-05 | **Realtime**: one WebSocket endpoint `/v1/ws`. Fan-out across API instances through PostgreSQL `LISTEN/NOTIFY`. Offline devices get FCM | Works on one instance today and many later |
| DEC-06 | **Push**: FCM HTTP v1 through `firebase-admin`, behind a `PushSender` interface. Buzz and incoming calls are high-priority **data** messages so the app controls vibration and UI | Notification-only messages cannot control vibration patterns reliably |
| DEC-07 | **Object storage**: any S3-compatible service (MinIO in local and CI) with presigned `PUT`/`GET`. Used for voice notes, video messages, receipts, export files | Portable |
| DEC-08 | **Video calls**: WebRTC, 1:1 in P2 and up to 4 people (mesh) in P3. Signalling over the WebSocket. `coturn` for STUN/TURN with ephemeral HMAC credentials from the API | No paid SFU; fits family-size groups |
| DEC-09 | **Payments**: a `PaymentGateway` interface with adapters for bKash, Nagad and SSLCommerz. Webhooks are verified and idempotent. The app never asks for a wallet PIN | BRD §9 |
| DEC-10 | **Entitlements**: device-based voice entry and typed AI parse stay available on every plan until the AI quota is used up. Receipt vision, Ask, export beyond CSV, and more than 3 members need a paid plan | Resolves the BRD §8 conflict with the voice-first MVP |
| DEC-11 | **Migrations**: committed SQL migrations generated by `drizzle-kit generate` and applied on startup by a migration runner. `drizzle-kit push` is removed from Compose and CI | Repeatable, reviewable schema history |
| DEC-12 | **Admin console** is a separate Next.js app (`apps/admin`) with its own auth (email, Argon2id password, TOTP). Its API lives in the `admin` module under `/admin/v1` | Different users, different risk |
| DEC-13 | **Mobile navigation** uses `go_router` (deep links for invites, buzz taps and incoming calls). Strings use Flutter `gen_l10n` with Bangla and English ARB files | Needed for notifications and invite links |
| DEC-14 | **Chat is server-authoritative and append-only.** It is cached in SQLite on the phone but not merged by HLC. Only ledger transactions use HLC sync (FR-SYNC-02) | Messages do not conflict; simpler |
| DEC-15 | **Presence** is derived from WebSocket connections and a heartbeat; "last seen" is shown in words, never exact times; each user can hide it | Privacy inside families |
| DEC-16 | **Retention**: voice notes and video messages 180 days; chat text until deleted; call metadata 90 days; no call media is ever recorded | PDPO data minimisation |
| DEC-17 | **API contract**: Zod schemas in `packages/shared` generate an OpenAPI 3.1 document; Dart models are checked against it by a contract test | Prevents web/mobile drift |
| DEC-18 | **Staff access to family data** is by aggregate DTOs only, from facades marked `@staff-safe`. The `admin` module may not import any other module's internals | PDPO and trust |

---

## 3. System architecture: modular monolith

### 3.1 Principles
1. One deployable unit (`apps/api`), started with `node dist/server.js`. An optional `--role=worker` flag runs only jobs, using the same image.
2. Each module owns its **code**, its **tables** and its **events**. Nothing else may touch them.
3. Modules talk through (a) **facades** (synchronous calls) and (b) **events** (asynchronous, durable).
4. A module can be extracted into a service later by replacing its facade with a network client. Nothing in this SRS requires that today.

### 3.2 Folder layout

```
apps/api/src/
├── server.ts                  process entry (parses config, builds the app, starts listening)
├── app.ts                     builds Fastify, registers modules in dependency order
├── modules/
│   ├── <module>/
│   │   ├── index.ts           FACADE: the only importable surface (types + functions + event types)
│   │   ├── http/              routes and request/response mapping (never exported)
│   │   ├── domain/            pure business rules, no I/O
│   │   ├── app/               use cases (orchestrate domain + repositories + events)
│   │   ├── infra/             repositories (Drizzle), adapters (FCM, S3, gateways)
│   │   ├── schema.ts          Drizzle tables, in `pgSchema("<module>")`
│   │   ├── events.ts          event types published by this module
│   │   └── jobs.ts            pg-boss job handlers and schedules
│   └── ...
└── platform/                  cross-cutting infrastructure used by all modules (§3.6)
```

### 3.3 Modules

| Module | Owns | Depends on (facades only) |
|---|---|---|
| `identity` | users, sessions (refresh tokens), OTP challenges, consents, devices | platform |
| `families` | families, members and roles, invites, ownership transfer, suspension flag | identity |
| `ledger` | accounts, categories, transactions, merchant rules, attachments (receipts) | families |
| `budgeting` | monthly and festival budgets, alert state | families, ledger |
| `recurring` | recurring templates, monthly drafts, bill reminders | families, ledger |
| `ai` | parse pipeline, summary, ask, receipt vision, usage metering, quota checks | families, ledger, billing |
| `reporting` | summaries, trends, remittance report, CSV export | families, ledger |
| `sync` | HLC change log endpoint for ledger transactions (server side of FR-SYNC-02/04/05) | families, ledger |
| `comms` | conversations, messages, nudges, voice notes, video messages, call sessions, presence | families, identity, notifications |
| `notifications` | notification inbox, preferences, FCM sender, scheduler for reminders | identity, families |
| `shopping` | shared bazaar lists | families, ledger |
| `lending` | dhar records and repayments | families |
| `billing` | plan catalogue, subscriptions, payments, entitlements | families |
| `privacy` | data export jobs, erasure requests, retention jobs | identity, families, ledger, comms (through erase hooks) |
| `admin` | staff users, staff sessions, audit log, console queries | families, billing, privacy, platform |
| `platform` | config, logging, errors, http helpers, outbox, jobs, rate limits, storage, feature flags, health | none |

### 3.4 Rules (enforced in CI)
- **R1** A module may import only another module's `index.ts`. Importing `modules/x/infra/...` from outside `x` fails the build (`dependency-cruiser` rule `no-cross-module-internals`).
- **R2** Dependency direction follows the table in §3.3. Cycles fail the build (`no-circular`).
- **R3** Drizzle tables are declared only in the owning module's `schema.ts` and are never exported from its `index.ts`.
- **R4** No SQL joins across module schemas. Needed data comes through a facade function returning a typed DTO.
- **R5** Cross-module side effects use events (§3.5). Example: `ledger` publishes `TransactionCreated`; `budgeting` subscribes and evaluates alerts.
- **R6** The `admin` module may import only facades annotated `@staff-safe`, which return aggregates (§11.3).
- **R7** `domain/` imports nothing from `infra/`, `http/`, Drizzle or Fastify.
- **R8** Each module exposes a `registerModule(app, ctx)` function; `app.ts` is the only place that knows the module list.
- **R9** An architecture test (`apps/api/src/architecture.test.ts`) fails if a new folder under `modules/` lacks `index.ts`, `schema.ts` or `events.ts`.

### 3.5 Events
- Event names are past tense, versioned, and typed in the publisher's `events.ts`, for example `ledger.TransactionCreated.v1`.
- Publishing happens in the same database transaction as the state change by writing to `platform.outbox`. A pg-boss job drains the outbox, calls each subscriber, and retries with back-off (max 10 attempts, then a dead-letter row visible in system health).
- Handlers must be idempotent (keyed by event id).
- Cross-module event catalogue:

| Event | Publisher | Subscribers (reaction) |
|---|---|---|
| `identity.UserErased.v1` | identity | families (remove memberships), comms (redact), ledger (anonymise), notifications (delete inbox) |
| `families.FamilyCreated.v1` | families | ledger (seed categories and cash account), budgeting (none), comms (create family conversation) |
| `families.MemberJoined.v1` / `MemberRemoved.v1` | families | comms (conversation membership), notifications (welcome / invite accepted) |
| `families.FamilySuspended.v1` | families | notifications, comms (block sends) |
| `ledger.TransactionCreated.v1` / `Updated.v1` / `Deleted.v1` | ledger | budgeting (alert evaluation), comms (expense card), reporting (cache bust) |
| `budgeting.BudgetThresholdCrossed.v1` | budgeting | notifications (push + inbox), comms (optional buzz) |
| `recurring.BillDue.v1` | recurring | notifications |
| `comms.NudgeSent.v1`, `comms.MessageSent.v1`, `comms.CallInvited.v1` | comms | notifications (FCM if recipient has no live socket) |
| `billing.SubscriptionChanged.v1` | billing | families (member limits), ai (quota), notifications |
| `privacy.ErasureRequested.v1` | privacy | identity, families, ledger, comms, notifications |

### 3.6 Platform services (`apps/api/src/platform`)
Config (typed env parsing), logger (pino with redaction of phone numbers, tokens, message bodies), error model (`HttpError`, RFC 7807-style body), request context (user id, family id, request id), outbox and event bus, job queue wrapper (pg-boss), rate limiter (database-backed buckets), object storage client, feature flags (table plus env override), health and readiness probes, OpenAPI generation, WebSocket hub, clock and id generators (injectable for tests).

### 3.7 Deployment
- **Local and CI**: `docker compose up` starts PostgreSQL, MinIO, coturn, a fake FCM/SMS/payment server (`tools/fakes`), the API, the web app and the admin console. No real credentials needed.
- **Production**: one API container (scale horizontally later; WebSocket fan-out already uses `LISTEN/NOTIFY`), one worker container using the same image, managed PostgreSQL, S3-compatible bucket, coturn host, web and admin as separate containers.
- Readiness (`/ready`) checks the database and the job queue; liveness (`/health`) stays cheap.

---

## 4. Functional requirements

Columns: **Pri** M/S/C, **Ph** P1/P2/P3, **Screens** = design boards that show it. IDs from v0.2 are kept so older references still work. A requirement marked *(new)* did not exist in v0.2.

### 4.1 Identity and accounts (module `identity`)

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-AUTH-01 | Sign up or log in with a Bangladeshi mobile number and a 6-digit OTP | M | P1 | A1 |
| FR-AUTH-02 | Validate BD numbers with `^(?:\+?88)?01[3-9]\d{8}$`; store as `+8801XXXXXXXXX` | M | P1 | A1 |
| FR-AUTH-03 | Access JWT (15 min). Refresh token (30 days) is **stored hashed**, **rotated on every use**, and a reused old token revokes the whole session family. Logout revokes. | M | P1 | F6 |
| FR-AUTH-04 | Profile: display name, language (bn/en), numeral style (Bangla/Latin), Simple mode, daily reminder time. Changes sync across the user's devices | M | P1 | D1, F8 |
| FR-AUTH-05 | Delete account and personal data, with export first (see FR-PRIV-03) | M | P1 | F7 |
| FR-AUTH-06 | Optional email or Google sign-in for family members abroad | C | P3 | — |
| FR-AUTH-07 *(new)* | OTP rules: valid 5 minutes, max 5 wrong tries per code, max 5 codes per number per hour and 20 per day, 60-second resend gap. The API returns a machine-readable error (`otp_invalid` with `attemptsLeft`, `otp_expired`, `otp_rate_limited` with `retryAfterSeconds`) so the app can show screen `A7` | M | P1 | A1, A7 |
| FR-AUTH-08 *(new)* | OTP delivery through a BD SMS gateway adapter (`SmsGateway`), with delivery receipts stored for health metrics. Development and CI use a fake gateway that exposes the last code to tests | M | P1 | A1 |
| FR-AUTH-09 *(new)* | Session expiry: when refresh fails, the app shows `F6` ("আবার ঢুকুন"), keeps local data, and returns to the same screen after login | M | P1 | F6 |
| FR-AUTH-10 *(new)* | Consent record: at sign-up the user accepts the privacy policy version shown on `A2`; stored with version, timestamp and locale. A new policy version asks again before the next use | M | P1 | A2 |
| FR-AUTH-11 *(new)* | Device registry: each install registers `{deviceId, platform, fcmToken, appVersion, locale}`; tokens are refreshed on change and removed on logout or when FCM reports them invalid | M | P1 | — |

### 4.2 Families (module `families`)

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-FAM-01 | Create a family (name, currency BDT); the creator becomes Owner. Creating also seeds the default categories, a Cash account and the family conversation | M | P1 | A2 |
| FR-FAM-02 | Owner/Admin invite by phone number or a shareable link valid 7 days. Accepting from the link shows `A6` (who invited, family name, role, what you can do, days left). Expired or used links show `F6` | M | P1 | A6, B4, F6 |
| FR-FAM-03 | Owner/Admin change roles and remove members (rules in `families/domain/roles.ts`: only Owner creates Admins; nobody assigns Owner) | M | P1 | B4 |
| FR-FAM-04 | A user can belong to several families and switch. The active family is remembered per device. Each family shows role, unread chat count and open alerts | S | P2 | F2 |
| FR-FAM-05 | Viewer role with a summary-only ledger view (no individual transactions), plus the remittance view | S | P2 | E6 |
| FR-FAM-06 *(new)* | Invite by phone: if the invited number already has an account, the invite appears in their notification inbox and as a push; otherwise an SMS with the link is sent | M | P1 | B4, F3 |
| FR-FAM-07 *(new)* | Ownership transfer: Owner picks an Admin; takes effect immediately; logged. Required before an Owner can delete their account | M | P1 | B4, F7 |
| FR-FAM-08 *(new)* | Orphaned family handling: if an Owner is erased without transfer, the oldest Admin becomes Owner; if none, the oldest Member; if none, the family is scheduled for deletion in 30 days | M | P1 | G1 |
| FR-FAM-09 *(new)* | Suspension: a suspended family is read-only for ledger and cannot send new comms; members see a plain-language banner. Only staff can suspend (FR-ADM-06) | M | P2 | — |
| FR-FAM-10 *(new)* | Member limit follows the plan (Free: 3, Plus: 8). Inviting beyond the limit returns `plan_member_limit` and the app opens `E7` | M | P2 | E7 |

### 4.3 Accounts and categories (module `ledger`)

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-ACC-01 | Accounts with a type: `cash`, `bkash`, `nagad`, `rocket`, `upay`, `bank`, `card`, `other` | M | P1 | E1 |
| FR-ACC-02 | An account can have an owner member or be shared | M | P1 | E1 |
| FR-ACC-03 | Running balance = opening + income − expense ± transfers, computed by the server and returned with each account | S | P2 | E1 |
| FR-ACC-04 *(new)* | Archive instead of delete; archived accounts stay on old transactions and are hidden from pickers | M | P1 | E1 |
| FR-CAT-01 | Seed the default Bangla/English categories (list unchanged from v0.2) | M | P1 | A4, E2 |
| FR-CAT-02 | Add, rename, hide, choose an icon from the fixed icon set (the 20 icons used in `A4` and `E2`) | M | P1 | E2 |
| FR-CAT-03 | Income categories: Salary, Business, Remittance Received, Rent Received, Other | M | P1 | E2 |

### 4.4 Transactions (module `ledger`)

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-TXN-01 | Create a transaction: type, amount, date-time, category, account, paid-by, note, counterparty, TrxID, fee | M | P1 | D4 |
| FR-TXN-02 | List with filters (month, category, member, account, type, source, text) and **cursor pagination** (50 per page, stable order by `occurredAt desc, id desc`). Returns day group headers on request | M | P1 | B1 |
| FR-TXN-03 | Edit and delete by role. Delete is soft; **restore is available for 30 days** (`POST …/restore`); then purged | M | P1 | D5 |
| FR-TXN-04 | Reject duplicate `trxId` per family (`409 duplicate_trx_id`) | M | P1 | A5 |
| FR-TXN-05 | Private transactions: visible only to the creator, counted in totals only for the creator, never in staff aggregates | S | P2 | D4, B1 |
| FR-TXN-06 | Recurring templates (see FR-REC) | S | P2 | E3 |
| FR-TXN-07 | Attach a receipt image (≤ 5 MB JPEG/PNG/WebP, compressed on device to ≤ 300 KB) stored in object storage; show it on the detail screen | S | P2 | D6, D5 |
| FR-TXN-08 | Split one receipt across several categories: creates linked child transactions that share a `splitGroupId`; the parent amount is the sum | C | P3 | D6 |
| FR-TXN-09 *(new)* | Manual entry form with the fields in `D4`, a numeric keypad, category icon row, account chips, "who paid", date shortcuts (today/yesterday), optional fee and the private toggle. Saves offline | M | P1 | D4 |
| FR-TXN-10 *(new)* | Detail screen: shows source (voice, SMS, photo, hand), TrxID, attachment, edit/delete; "you can only change your own" message for Members; shows the undo banner after delete | M | P1 | D5 |
| FR-TXN-11 *(new)* | Every create or update stamps an HLC (REST and sync paths use the same function) | M | P1 | — |

### 4.5 AI-assisted entry (module `ai`)

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-AI-01 | Free-text parse into one or more drafts | M | P1 | A3, Main |
| FR-AI-02 | Deterministic bKash/Nagad/Rocket SMS parser first, LLM only as fallback | M | P1 | A5 |
| FR-AI-03 | Normalise Bangla/Latin digits and lakh formatting | M | P1 | — |
| FR-AI-04 | Resolve relative dates in `Asia/Dhaka` | M | P1 | — |
| FR-AI-05 | The AI never writes final records; drafts need confirmation | M | P1 | A3 |
| FR-AI-06 | Family categories are passed to the AI so it can only choose valid ones | M | P1 | — |
| FR-AI-07 | Category learning: when a user changes a draft's category, the app asks `D7` ("এরপর থেকে … সবসময় …?"). On yes, a per-family merchant rule is stored and applied **before** the LLM. Rules are listed and deletable | S | P2 | D7 |
| FR-AI-08 | Voice entry (see FR-VOICE-01..03) | M | P1 | A3 |
| FR-AI-09 | Receipt/memo photo → drafts, including handwritten Bangla memos; the screen shows the photo, parsed lines by category, total and read-back | S | P2 | D6 |
| FR-AI-10 | Ask: natural-language questions answered through read-only server tools scoped to the family and the caller's visibility | S | P2 | B5 |
| FR-AI-11 | Monthly summary (3–5 sentences) with amounts only through placeholders; text and speech renderings | M | P1 | B2 |
| FR-AI-12 | Per-family monthly AI quota by plan. When exhausted, the API returns `429 ai_quota`; the app shows the quota card at the top of `E7` and keeps offline parsing and manual entry working | M | P1 | E7 |
| FR-AI-13 | Offline quick parser on the device (one amount + known keyword) | M | P1 | A3 |
| FR-AI-14 *(new)* | Usage metering: per call store family, month, feature (`parse`, `receipt`, `ask`, `summary`), input tokens, output tokens, latency ms, outcome. No content | M | P1 | G1 |
| FR-AI-15 *(new)* | Cost guard: a per-family daily ceiling (default 3× the daily average of the plan quota) and a global monthly spend alarm exposed to system health | S | P2 | G4 |

### 4.6 Budgets (module `budgeting`)

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-BUD-01 | Monthly budget per category and overall | M | P1 | B3 |
| FR-BUD-02 | Alerts at 80% and 100% to Owner/Admins (and optionally all members), through push and the inbox | M | P1 | B3, F3 |
| FR-BUD-03 | Carry last month's budgets forward automatically on the 1st (Asia/Dhaka) unless already set | S | P1 | B3 |
| FR-BUD-04 | Festival budget with a date range and a suggested split by category | S | P2 | E4 |
| FR-BUD-05 *(new)* | Alert engine: reacts to `ledger.TransactionCreated/Updated/Deleted`, recalculates the affected budgets, and publishes `BudgetThresholdCrossed` **once per threshold per month** (re-arms when spending drops below and the month changes) | M | P1 | — |
| FR-BUD-06 *(new)* | "Tell someone": from a budget alert (Home strip, `B3` card) the user can send a buzz with phrase "বাজেট শেষ" to a chosen member (uses FR-NUDGE-01) | S | P2 | Main, B3 |
| FR-BUD-07 *(new)* | Status is shown with colour **and** icon **and** words (ঠিক আছে / সাবধান / বাজেট শেষ) and can be read aloud | M | P1 | B3 |

### 4.7 Recurring and bills (module `recurring`)

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-REC-01 | Monthly templates (name, amount, category, account, day of month, start/end, remind-days-before) | S | P2 | E3 |
| FR-REC-02 | On the due month the server creates a **draft** ("এ মাসের খসড়া") the user confirms with ✓ or skips with ✗; confirming creates the transaction once per month | S | P2 | E3 |
| FR-REC-03 | Reminder N days before the due day (default 2) at 09:00 Asia/Dhaka through push and inbox (FR-NOT-03) | S | P2 | E3, F3 |

### 4.8 Reports and export (module `reporting`)

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-REP-01 | Month summary: income, expense, net, comparison with last month | M | P1 | Main, B2 |
| FR-REP-02 | Breakdown by category, member and account (segmented control) | M | P1 | E5 |
| FR-REP-03 | 6- and 12-month trend per category and total | S | P2 | E5 |
| FR-REP-04 | CSV export for a month or range (P1); Excel and PDF (P3) | S | P1/P3 | B1, E5 |
| FR-REP-05 *(new)* | Remittance report for Viewers: remittance received vs spent by category and month, running balances, no individual transactions | S | P2 | E6 |
| FR-REP-06 *(new)* | All report endpoints exclude other members' private transactions and never expose them in any aggregate except the caller's own | M | P1 | — |

### 4.9 Notifications (module `notifications`)

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-NOT-01 | FCM push for budget alerts, invitations, reminders, buzz, messages and calls | M | P1 | F3 |
| FR-NOT-02 | Daily "log your spending" reminder at the user's time (default 21:00 Asia/Dhaka), skipped if the user already logged something that day | S | P1 | F3, F8 |
| FR-NOT-03 | Bill-due reminders from recurring templates | S | P2 | F3 |
| FR-NOTIF-04 *(new)* | Notification inbox: list, mark read, "listen" to each item (text-to-speech), "listen to all", clear. Server-stored for 90 days | M | P1 | F3 |
| FR-NOTIF-05 *(new)* | Preferences per user: per-type on/off, quiet hours (default 22:00–06:00), daily reminder time. Quiet hours silence vibration and sound but never drop the inbox item | M | P1 | B6, F3 |
| FR-NOTIF-06 *(new)* | Android channels: `nudge` (custom vibration), `chat`, `alerts`, `reminders`, `calls` (high importance, full-screen intent). Created on first launch with Bangla names | M | P1 | — |
| FR-NOTIF-07 *(new)* | Delivery rule: if the recipient has a live WebSocket, deliver over it and skip FCM; otherwise send FCM. Invalid tokens are deleted on `UNREGISTERED` responses | M | P1 | — |
| FR-NOTIF-08 *(new)* | Fallback when push is unavailable: foreground polling of `/v1/inbox/changes` every 60 seconds | S | P2 | — |

### 4.10 Offline and sync (module `sync`, mobile local store)

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-SYNC-01 | Offline capture of transactions on the phone, synced later | S | P2 | F4 |
| FR-SYNC-02 | Client UUIDs; per-record last-write-wins by HLC; shared test vectors | S | P2 | — |
| FR-SYNC-03 | AI parsing of text captured offline is queued and run when online; shown in the offline status screen | S | P2 | F4 |
| FR-SYNC-04 | Peer-to-peer sync (Nearby Connections) with a list of nearby family devices | S | P2 | F4 |
| FR-SYNC-05 | Server sync with cursor paging (built; spec in §9) | S | P2 | F4 |
| FR-SYNC-06 *(new)* | Background sync: on connectivity change, app start, after a local write (debounced 5 s) and every 15 minutes through WorkManager. Never blocks the UI | M | P2 | F4 |
| FR-SYNC-07 *(new)* | Sync status UI: offline banner with pending count, last synced time (in words), manual sync, nearby sync toggle and device list | M | P2 | F4, Main |
| FR-SYNC-08 *(new)* | Reference data (categories, accounts, budgets, members, plan entitlements) is refreshed on each sync and cached locally so every screen works offline | M | P2 | F4 |

### 4.11 Voice and low-literacy interaction (mobile and web)

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-VOICE-01 | Large mic button; Bangla (`bn-BD`) recognition by the device; audio not uploaded | M | P1 | Main, A3 |
| FR-VOICE-02 | Transcript goes through the parse pipeline; drafts marked `source = voice` | M | P1 | A3 |
| FR-VOICE-03 | Read-back of the draft; unknown category opens the picture picker | M | P1 | A3, A4 |
| FR-VOICE-04 | Monthly summary "Listen" with device TTS (`bn-BD`, rate 0.9) | M | P1 | B2 |
| FR-VOICE-05 | Spoken amounts in Bangla words (South Asian grouping) | M | P1 | A3, B2 |
| FR-VOICE-06 | Every draft has 🔊, ✓, ✗; category icons speak their names | M | P1 | A3, A4 |
| FR-VOICE-07 | When recognition or a Bangla voice is missing: explain plainly, link to install the Bangla voice, keep typing working | S | P1 | D8 |
| FR-VOICE-08 | Voice conversation with Ask; hold-to-talk mic; spoken answer with replay and suggested questions | S | P2 | B5 |
| FR-VOICE-09 | **Simple mode**: larger text (×1.3), icons with words only, one huge mic, four picture tiles, auto read-aloud of every result, a link back to normal mode. Persisted per user | S | P2 | D3, D1 |
| FR-VOICE-10 | Voice-guided first-run tutorial of 4 steps with progress "২ / ৪", replay and skip | C | P2 | D2 |

### 4.12 Family communication (module `comms`)

This is the largest new area. Screens: Home (`Main`), `1`–`6`, `F1`, `F2`, `B4`, `Chat`.

**Buzz (vibration nudge)**

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-NUDGE-01 | A member sends a buzz to one or more family members: choose recipients, a preset phrase and an intensity (soft, medium, strong). Preset phrases (Bangla): খেতে আসুন, ফোন করুন, বাড়ি আসুন, খরচ লিখুন, ওষুধ খান, শুধু ডাকছি, বাজেট শেষ. Phrases are a server-side catalogue so they can be extended without an app update | M | P1 | 2, Main, B4, Chat |
| FR-NUDGE-02 | Delivery: over WebSocket if the recipient is connected, else FCM high-priority data message. The recipient app vibrates with the pattern for the intensity (soft `[0,200]`, medium `[0,300,150,300]`, strong `[0,500,200,500,200,500]` ms), shows the full-screen card `6`, and speaks the phrase with TTS unless quiet hours apply | M | P1 | 6 |
| FR-NUDGE-03 | Reply actions on the card: **আসছি** (coming), **পরে বলছি** (later), **ফোন করি** (call: starts a call, FR-VIDEO-01). The reply is delivered to the sender as a buzz-reply event and appears in the chat | M | P1 | 6, Chat |
| FR-NUDGE-04 | Delivery states: `sent`, `delivered` (device received), `seen` (card opened), `replied`. The sender sees them in the chat as words ("পৌঁছেছে", "দেখেছে") | M | P1 | Chat |
| FR-NUDGE-05 | Abuse limits: max 3 buzzes per sender→recipient per minute and 20 per hour; excess returns `429 nudge_rate_limited` with a plain message | M | P1 | 2 |
| FR-NUDGE-06 | Quiet hours of the recipient (FR-NOTIF-05) silence vibration and sound; the card is still in the inbox. The sender sees "চুপ সময়, পরে দেখবেন" before sending | M | P1 | 2, F3 |
| FR-NUDGE-07 | A buzz is also a chat event card ("আব্বু আম্মুকে কম্পন দিয়েছেন: খেতে আসুন") | M | P1 | Chat |
| FR-NUDGE-08 | When the app is in the foreground the vibration uses the platform vibrator directly; in the background it is triggered by the FCM background handler and the `nudge` notification channel (vibration pattern set on the channel as a fallback) | M | P1 | — |

**Text chat**

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-CHAT-01 | Each family has a group conversation ("সবাই") created automatically; any two members can open a 1:1 conversation. Viewers can chat | M | P1 | F1, Chat |
| FR-CHAT-02 | Send text up to 2,000 characters. The client supplies a UUID so retries never duplicate. Messages are ordered by server time then id | M | P1 | Chat |
| FR-CHAT-03 | Delivery and read receipts per recipient (shown as ✓ / ✓✓ words: "পৌঁছেছে", "পড়েছে") | S | P1 | Chat |
| FR-CHAT-04 | Conversation list with last-message preview and type icon (text, voice, video, buzz, expense), time, unread badge; unread counts also appear on the "কথা" tab | M | P1 | F1, Main |
| FR-CHAT-05 | System cards: expense recorded (`ledger` event), buzz, call started/missed, member joined. Cards for private transactions are never created | M | P1 | Chat |
| FR-CHAT-06 | Offline: messages are composed and queued locally, shown as "পাঠানো হচ্ছে", and sent in order on reconnect. Local cache holds the last 500 messages per conversation | M | P1 | Chat |
| FR-CHAT-07 | The sender can delete their own message for everyone within 24 hours (replaced by "মুছে ফেলা হয়েছে"); admins cannot read or delete members' messages | S | P2 | Chat |
| FR-CHAT-08 | "Listen" on any text message (TTS) and auto read-aloud in Simple mode | S | P2 | Chat |
| FR-CHAT-09 | Typing indicator and "online" dots, subject to presence privacy (DEC-15) | C | P2 | Main, F1 |

**Voice notes**

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-VNOTE-01 | Record up to 60 seconds with a large timer and waveform; ✓ stops and plays back before sending; "বাদ" discards. Recording starts only after microphone permission with a Bangla explanation | M | P1 | 4 |
| FR-VNOTE-02 | Audio is mono at about 32 kbps (≤ 300 KB per minute). Accepted types: `audio/mp4` (AAC-LC, recorded by the Android app) and `audio/webm;codecs=opus` (recorded by browsers). Both Flutter and the web player must play both types. Upload: client asks `POST /v1/conversations/:id/voice-notes` for a presigned URL, uploads to storage, then confirms; the message appears when confirmed | M | P1 | 4, Chat |
| FR-VNOTE-03 | Playback with a large play button, seek, 1× and 1.5× speed; auto-download on Wi-Fi, tap to download on mobile data | M | P1 | Chat |
| FR-VNOTE-04 | First-use notice (Bangla): "ভয়েস মেসেজ আমাদের সার্ভারে থাকবে, ১৮০ দিন পর মুছে যাবে।" Acceptance is stored with the consent record | M | P1 | 4 |
| FR-VNOTE-05 | Voice notes are never transcribed or sent to AI in P1 and P2 | M | P1 | — |

**Video messages and calls**

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-VMSG-01 | Record a video message up to 30 seconds, 360p H.264, ≤ 8 MB, with a thumbnail; upload like voice notes; shown as a bubble with a play button | S | P2 | Chat |
| FR-VIDEO-01 | 1:1 video calls between family members using WebRTC; either side can start from Chat, a member row, `F1` or a buzz reply | S | P2 | 5, B4 |
| FR-VIDEO-02 | Group calls up to 4 participants (mesh) | C | P3 | 5 |
| FR-VIDEO-03 | Signalling over the WebSocket (`call.invite`, `call.accept`, `call.reject`, `call.offer`, `call.answer`, `call.ice`, `call.end`). `GET /v1/rtc/ice` returns STUN/TURN servers with credentials valid for 1 hour (coturn REST secret) | S | P2 | — |
| FR-VIDEO-04 | Incoming call: FCM high-priority data message, full-screen incoming UI with continuous vibration pattern, accept/decline large buttons, 45-second ring timeout then "missed" | S | P2 | 5, 6 |
| FR-VIDEO-05 | In-call controls: mic mute, camera off, hang up (88 px red), connection-quality label (ভালো / দুর্বল / নেই) shown as words and icon; joiner list with status ("আসছেন…") | S | P2 | 5 |
| FR-VIDEO-06 | Low-bandwidth adaptation: start at 360p/15 fps, drop to 240p, then audio-only when packet loss > 15% for 5 s; show "শুধু কথা চলছে"; recover automatically | S | P2 | 5 |
| FR-VIDEO-07 | Call records (who, start, duration, missed/declined) are kept 90 days and appear as chat cards. No call media is recorded or stored | S | P2 | Chat |
| FR-VIDEO-08 | Busy handling: calling someone already in a call returns `busy`; the sender sees "ব্যস্ত আছেন" and can buzz instead | S | P2 | 5 |
| FR-VIDEO-09 | Camera and microphone permission flow with Bangla explanations; denial keeps audio-only available | S | P2 | 5 |

**Presence**

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-PRES-01 | Show who is online (green dot **and** word "অনলাইন"; grey **and** "অফলাইন") on Home and the member list. "Last seen" appears only as words ("আজ সকালে") | S | P2 | Main, B4 |
| FR-PRES-02 | Setting to hide my presence (shown as offline to others) | S | P2 | F8 |

### 4.13 Shared bazaar list (module `shopping`) — new idea

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-SHOP-01 | A family has shared lists (default "বাজার"). Items: name, quantity text, estimated price, added by, checked by, checked at | S | P2 | F5 |
| FR-SHOP-02 | Add by typing or voice ("চাল দুই কেজি"); tick to mark bought; changes appear on all members' phones in real time and work offline | S | P2 | F5 |
| FR-SHOP-03 | "বাজারে খরচ লিখুন" turns the checked items into one expense draft with the sum of estimated prices, which the user edits and confirms | S | P2 | F5 |
| FR-SHOP-04 | Completing a list archives it; the last 10 lists are kept | C | P3 | F5 |

### 4.14 Dhar: money lent and borrowed (module `lending`) — BR-18 made concrete

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-LEND-01 | Record a dhar entry: direction (আমি পাব / আমি দেব), person name, optional phone, amount, date, due date, note, private flag | C | P3 | E8 |
| FR-LEND-02 | Partial repayments with dates; status is derived: open, partly paid, settled, overdue (word + icon) | C | P3 | E8 |
| FR-LEND-03 | Reminder on the due date and 3 days before; "ফেরত পেয়েছি" settles with one tap | C | P3 | E8 |
| FR-LEND-04 | Dhar entries never count as spending in reports unless the user links a repayment to a transaction | C | P3 | E8 |

### 4.15 Plans and payments (module `billing`)

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-BILL-01 | Plan catalogue: Free (৳0; 3 members; 100 AI entries/month; 6-month history), Poribar Plus (৳99/month or ৳999/year; 8 members; 1,000 AI entries; receipt vision, Ask, export; unlimited history), Probashi (৳149/month; Plus + remittance planner + multi-currency). Editable by staff (FR-ADM-07) | C | P3 | E7, G1 |
| FR-BILL-02 | Checkout with bKash or Nagad (or card through SSLCommerz): the API creates a payment, returns a hosted checkout URL, and the app opens it. The app never sees a wallet PIN or OTP | C | P3 | E7 |
| FR-BILL-03 | Webhooks from gateways are signature-verified and idempotent. A paid payment activates the subscription and publishes `SubscriptionChanged` | C | P3 | — |
| FR-BILL-04 | Subscription states: `active`, `past_due` (3-day grace), `canceled_at_period_end`, `expired`. Downgrade keeps data; features above the Free limits become read-only; members above the limit stay but cannot be added | C | P3 | E7 |
| FR-BILL-05 | `entitlements(familyId)` facade returns limits and feature flags; other modules never read plan tables | M | P2 | — |
| FR-BILL-06 | Invoices (number, amount, period, status) listed in the app and downloadable as PDF | C | P3 | E7 |
| FR-BILL-07 | History limit: Free keeps 6 months visible; older data stays stored and returns when upgrading | C | P3 | — |

### 4.16 Privacy (module `privacy`)

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-PRIV-01 | Consent versions and acceptance log (see FR-AUTH-10, FR-VNOTE-04) | M | P1 | A2 |
| FR-PRIV-02 | Privacy policy served in Bangla and English from the API (`/v1/policy`) with a version string | M | P1 | A2, F8 |
| FR-PRIV-03 | **Data export**: a user requests it; a job builds a ZIP (JSON + CSV of their profile, their own transactions, messages they sent, consents) in object storage; the user gets a push and a 7-day link. Target: ready within 24 hours | M | P1 | F7 |
| FR-PRIV-04 | **Erasure**: the user types the last 3 digits of their phone to confirm; the account is disabled immediately and erased after a 30-day grace period (cancel by logging in). Erasure deletes profile, sessions, devices, inbox, consents, voice/video files, and redacts their chat messages; transactions they wrote stay with `createdBy` replaced by a "deleted user" id; the owner rule FR-FAM-07 applies | M | P1 | F7 |
| FR-PRIV-05 | A privacy request record (type, status, deadlines, steps) exists for each export and erasure and is visible to staff as counts and status only (FR-ADM-05) | M | P1 | C4 |
| FR-PRIV-06 | Retention jobs run daily: soft-deleted transactions purged at 30 days; voice/video at 180 days; call logs and notifications at 90 days; expired invite links at 30 days; used OTP challenges at 24 hours | M | P1 | — |
| FR-PRIV-07 | A generated "record of processing" document is built from the module registry (data types, purpose, retention, processors including cross-border AI) | S | P2 | — |

### 4.17 Admin console (module `admin`, app `apps/admin`)

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-ADM-01 | Staff sign-in with work email and password (Argon2id), plus a 6-digit TOTP code. 5 wrong attempts lock the account for 15 minutes. Session idle timeout 30 minutes, absolute 8 hours. Lost device recovery by a Staff Owner resetting TOTP | M | P2 | C0 |
| FR-ADM-02 | **Overview**: active families, average members per family, AI cost per active family against the ৳15 goal, open privacy requests with the oldest age, "needs attention" list (families at 90% of quota, OTP failure rate, families without an owner), weekly new families | M | P2 | C1 |
| FR-ADM-03 | **Families list**: search by name or masked owner phone; filter by plan, status (active, no owner, dormant, suspended) and AI quota; sort; paginate; export list as CSV (aggregates only) | M | P2 | C2 |
| FR-ADM-04 | **Family detail**: members and roles (masked phones), plan and quota, counts-only usage, recent staff actions. Actions: change plan, add AI entries, transfer ownership, suspend, unsuspend, start deletion. Every action needs a free-text reason (≥ 10 characters); destructive actions also require the family name typed (UI) and are rejected by the API without a `confirmFamilyName` | M | P2 | C3 |
| FR-ADM-05 | **Privacy requests**: queue with type, masked person, family, received date, deadline countdown (warning at ≤ 10 days, urgent at ≤ 5), current step; step-by-step handling; reject with reason | M | P2 | C4 |
| FR-ADM-06 | Suspend/unsuspend a family (FR-FAM-09) | M | P2 | C3 |
| FR-ADM-07 | **Plans and AI quota**: edit plan limits and prices, see family counts per plan, list families near quota, edit a family's quota override, chart AI cost per family vs the ৳15 goal | S | P3 | G1 |
| FR-ADM-08 | **Audit log**: append-only; each entry has staff user, action, target type and id, family id, reason, timestamp, request id, and a hash of the previous entry (tamper evidence). Filter and export. Nothing can edit or delete entries | M | P2 | G2 |
| FR-ADM-09 | **Staff accounts**: invite by email, assign role, enable/disable, force TOTP reset, role-permission matrix (view families, change plan, suspend, delete data, handle privacy requests, manage staff) | S | P2 | G3 |
| FR-ADM-10 | **System health**: API availability and p95 latency, OTP delivery rate, push (FCM) delivery rate, SMS gateway status, AI error and template-fallback rate, job queue depth and dead letters, last backup and last restore test | S | P2 | G4 |
| FR-ADM-11 | Staff never see: transactions, notes, counterparties, chat, voice, video, receipts, full phone numbers, or private-flagged anything. Enforced by DEC-18 and tested (§11.3) | M | P2 | C1–C4 |

### 4.18 Onboarding, accessibility and general UI

| ID | Requirement | Pri | Ph | Screens |
|---|---|---|---|---|
| FR-ONB-01 | First run: Welcome (language, numerals, Simple mode) → login → consent and create family (or join by invite) → optional tutorial → Home | M | P1 | D1, A1, A2, A6, D2 |
| FR-ONB-02 | Empty states with one clear action and a spoken hint on every list screen (transactions, chat, budgets, accounts, bazaar, dhar) | S | P2 | — |
| FR-ONB-03 | Error states in plain Bangla with one next step: offline, server down, session expired, quota reached, wrong code, expired invite | M | P1 | A7, F6, E7 |
| FR-A11Y-01 | All interactive elements have a Bangla accessibility label; touch targets ≥ 48 dp; primary actions ≥ 56 dp and secondary actions ≥ 48 dp (≥ 72 dp for primary in Simple mode). The admin console is a desktop tool for staff: its targets are ≥ 44 px | M | P1 | all |
| FR-A11Y-02 | Colour is never the only signal; every status uses icon + word | M | P1 | all |
| FR-A11Y-03 | Light and dark themes; text contrast ≥ 4.5:1 | M | P1 | all |
| FR-I18N-01 | Every string exists in Bangla and English; amounts follow the numeral setting; the admin console is English only | M | P1 | all |
| FR-NAV-01 | Five tabs everywhere: হোম, কথা, তালিকা, বাজেট, পরিবার. Settings is the gear on Home and on the family tab. Pushed screens have a back arrow and no tab bar | M | P1 | Main, B1, B3, B4, F1 |
| FR-HOME-01 | Home shows: month spending with change and a Listen button; budget warning strip with a "tell someone" action; one big "বলে খরচ লিখুন" button; tiles for buzz, chat and video; family avatars with presence; the latest family activity (voice notes, expenses). In Simple mode it is replaced by `D3` | M | P1 | Main, D3 |

---

## 5. External interface requirements

### 5.1 User interface

#### 5.1.1 Design tokens (from the design canvas)
| Token | Value | Use |
|---|---|---|
| Background | `#FFF8EE` | App background |
| Ink | `#2A2118` | Text |
| Muted | `#5A4B3B` | Secondary text (contrast ≥ 4.5:1 on background) |
| Green 700 / Green 100 | `#1B5E20` / `#E6F2E3` | Primary actions, positive state |
| Amber | `#F2A33A` | Buzz and the main "speak" action |
| Danger | `#B3261E` | Discard, over budget, end call |
| Border | `#E8DCC8` | Cards |
| Font | Hind Siliguri (bundled, 400/500/600/700) | All Bangla and Latin text |
| Radius | 20–28 dp cards, full pill for primary buttons | — |
| Sizes | Touch ≥ 48 dp; primary ≥ 56 dp; Simple mode primary ≥ 72 dp | — |
Dark theme tokens are derived by a fixed mapping in `packages/shared/src/design-tokens.ts` (and `lib/core/theme/tokens.dart`); a unit test checks every foreground/background pair against 4.5:1.

#### 5.1.2 Rules
1. Bangla is the default language; English is available; all strings are in catalogues (FR-I18N-01).
2. Amounts show as `৳ ১,২৫,০০০` (Bangla numerals) or `৳ 1,25,000` (Latin) per the user's setting.
3. Low-literacy rules of v0.2 §4.1.1 (voice first, hear before you save, pictures with words, few choices per screen, amounts two ways, plain language, colour never the only signal) apply to every screen.
4. One main action per screen. Destructive actions are never the largest button.
5. Navigation: FR-NAV-01.

#### 5.1.3 Screen catalogue
Every design board is implemented once on mobile (M) and, where marked W, on the web app. Staff screens are in `apps/admin` (A).

| Code | Screen | Req. | Mobile / Web / Admin |
|---|---|---|---|
| Main (1) | Home: money + family | FR-HOME-01 | M W |
| 2 | Buzz | FR-NUDGE-01, -05, -06 | M W |
| 3 / Chat | Family chat | FR-CHAT-01..08 | M W |
| 4 | Record voice note | FR-VNOTE-01..04 | M W |
| 5 | Video call | FR-VIDEO-01..09 | M W |
| 6 | Incoming buzz | FR-NUDGE-02, -03 | M |
| A1 | Login phone + OTP | FR-AUTH-01, -02, -07, -08 | M W |
| A2 | Consent + create family | FR-AUTH-10, FR-FAM-01 | M W |
| A3 | Voice entry read-back | FR-VOICE-01..03, FR-AI-08 | M W |
| A4 | Pick a category by picture | FR-VOICE-06 | M W |
| A5 | Paste bKash/Nagad SMS | FR-AI-02, FR-TXN-04 | M W |
| A6 | Join by invite link | FR-FAM-02 | M W |
| A7 | Wrong OTP state | FR-AUTH-07 | M W |
| B1 | তালিকা: transactions | FR-TXN-02, FR-REP-04 | M W |
| B2 | Monthly summary + Listen | FR-AI-11, FR-VOICE-04 | M W |
| B3 | বাজেট | FR-BUD-01, -02, -06, -07 | M W |
| B4 | পরিবার: members, buzz, chat | FR-FAM-02, -03, -07 | M W |
| B5 | Ask by voice | FR-AI-10, FR-VOICE-08 | M W |
| B6 | Settings | FR-AUTH-04, FR-NOTIF-05 | M W |
| C0 | Staff sign-in + 2FA | FR-ADM-01 | A |
| C1 | Admin overview | FR-ADM-02 | A |
| C2 | Admin families list | FR-ADM-03 | A |
| C3 | Admin family detail | FR-ADM-04, -06 | A |
| C4 | Admin privacy requests | FR-ADM-05, FR-PRIV-05 | A |
| D1 | Welcome | FR-ONB-01, FR-AUTH-04 | M W |
| D2 | Voice tutorial | FR-VOICE-10 | M |
| D3 | Simple mode home | FR-VOICE-09, FR-HOME-01 | M |
| D4 | Add expense by hand | FR-TXN-09, -05 | M W |
| D5 | Transaction detail, undo | FR-TXN-03, -10 | M W |
| D6 | Receipt photo | FR-AI-09, FR-TXN-07, -08 | M W |
| D7 | Category learning | FR-AI-07 | M W |
| D8 | No Bangla voice fallback | FR-VOICE-07 | M W |
| E1 | Accounts | FR-ACC-01..04 | M W |
| E2 | Categories | FR-CAT-01..03 | M W |
| E3 | Recurring bills | FR-REC-01..03 | M W |
| E4 | Festival budget | FR-BUD-04 | M W |
| E5 | Reports | FR-REP-02..04 | M W |
| E6 | Viewer remittance | FR-FAM-05, FR-REP-05 | M W |
| E7 | Plans + payment + quota | FR-BILL-01..06, FR-AI-12 | M W |
| E8 | Dhar | FR-LEND-01..04 | M |
| F1 | কথা tab | FR-CHAT-04 | M W |
| F2 | Switch family | FR-FAM-04 | M W |
| F3 | Notifications | FR-NOTIF-04, -05 | M W |
| F4 | Offline + nearby sync | FR-SYNC-03..08 | M |
| F5 | Bazaar list | FR-SHOP-01..03 | M W |
| F6 | Session / invite expired | FR-AUTH-09, FR-ONB-03 | M W |
| F7 | Delete my data | FR-AUTH-05, FR-PRIV-03, -04 | M W |
| F8 | Profile | FR-AUTH-04, FR-PRES-02 | M W |
| G1 | Admin plans + quota | FR-ADM-07 | A |
| G2 | Admin audit log | FR-ADM-08 | A |
| G3 | Admin staff | FR-ADM-09 | A |
| G4 | Admin system health | FR-ADM-10 | A |

### 5.2 API (REST, JSON, `/v1`, plus `/admin/v1` and WebSocket)

Conventions: `Authorization: Bearer <access JWT>`; errors `{ error: { code, message, details? } }`; list endpoints use `?cursor=&limit=` and return `{ items, nextCursor }`; idempotent creates accept a client `id` (UUID) and an `Idempotency-Key` header; times are ISO-8601 UTC; money is integer paisa.

Status column: **E** = exists in the repository today, **P** = partly, **N** = new.

| Module | Method and path | Purpose | State |
|---|---|---|---|
| identity | `POST /v1/auth/otp/request` | Send OTP | P (in-memory, no SMS) |
| identity | `POST /v1/auth/otp/verify` | Verify, return tokens | P |
| identity | `POST /v1/auth/refresh` | Rotate refresh token | P (stateless) |
| identity | `POST /v1/auth/logout` | Revoke session | N |
| identity | `PATCH /v1/me` | Update profile and preferences | N |
| composition | `GET /v1/me` | Profile plus families; lives in `apps/api/src/composition/` because it joins `identity` and `families` (the only layer allowed to import several facades) | P |
| identity | `POST /v1/me/consents` | Accept policy version | N |
| identity | `PUT /v1/me/devices/:deviceId` / `DELETE` | Register or remove push token | N |
| privacy | `GET /v1/policy?locale=` | Privacy policy and version | N |
| privacy | `POST /v1/me/export`, `GET /v1/me/export/:id` | Data export | N |
| privacy | `POST /v1/me/erasure`, `DELETE /v1/me/erasure` | Request / cancel erasure | N |
| families | `POST /v1/families` | Create | E |
| families | `GET /v1/families/:id` , `PATCH` | Read / rename | N |
| families | `POST /v1/families/:id/invites`, `GET`, `DELETE /:inviteId` | Invites | P |
| families | `GET /v1/invites/:token`, `POST /v1/invites/:token/accept` | Preview and accept | P |
| families | `GET /v1/families/:id/members`, `PATCH`/`DELETE /:userId` | Members | E |
| families | `POST /v1/families/:id/transfer-ownership` | Transfer | N |
| ledger | `GET/POST/PATCH /v1/families/:id/accounts` | Accounts (+ balances) | P |
| ledger | `GET/POST/PATCH /v1/families/:id/categories` | Categories | E |
| ledger | `GET /v1/families/:id/transactions` | List with filters and cursor | P (limit 200) |
| ledger | `POST /v1/families/:id/transactions`, `GET/PATCH/DELETE /:txnId` | CRUD | P (no GET one) |
| ledger | `POST /v1/families/:id/transactions/:txnId/restore` | Undo delete | N |
| ledger | `POST /v1/families/:id/transactions/:txnId/attachment` | Presigned upload for receipt | N |
| ledger | `GET/POST/DELETE /v1/families/:id/merchant-rules` | Learned rules | N |
| budgeting | `GET/PUT /v1/families/:id/budgets?month=` | Budgets | E |
| budgeting | `GET/POST/PATCH/DELETE /v1/families/:id/festival-budgets` | Festival | E |
| recurring | `GET/POST/PATCH /v1/families/:id/recurring`, `GET …/drafts`, `GET …/reminders`, `POST …/:id/confirm`, `POST …/:id/skip` | Recurring | P (skip is N) |
| ai | `POST /v1/families/:id/ai/parse` | Text/SMS → drafts | E |
| ai | `POST /v1/families/:id/ai/receipt` | Image → drafts | E |
| ai | `POST /v1/families/:id/ai/ask` | Question → answer | E |
| ai | `GET /v1/families/:id/ai/summary?month=&locale=` | Monthly summary | E |
| ai | `GET /v1/families/:id/ai/usage` | Quota and usage this month | N |
| reporting | `GET /v1/families/:id/reports/summary?month=` | Month summary | E |
| reporting | `GET /v1/families/:id/reports/trend?months=6\|12&categoryId=` | Trend | N |
| reporting | `GET /v1/families/:id/reports/remittances` | Remittances | E |
| reporting | `GET /v1/families/:id/reports/export.csv` | CSV | E |
| sync | `POST /v1/families/:id/sync` | HLC changesets | E |
| comms | `GET /v1/families/:id/conversations` | Conversation list | N |
| comms | `GET /v1/conversations/:id/messages?cursor=`, `POST …/messages` | Messages | N |
| comms | `POST /v1/conversations/:id/read` | Mark read up to message | N |
| comms | `DELETE /v1/messages/:id` | Delete own within 24 h | N |
| comms | `POST /v1/conversations/:id/voice-notes` , `POST /v1/voice-notes/:id/confirm` | Presigned upload and confirm | N |
| comms | `POST /v1/conversations/:id/video-messages`, `…/:id/confirm` | Same for video | N |
| comms | `GET /v1/media/:id` | Short-lived signed URL | N |
| comms | `GET /v1/nudge-phrases` | Phrase catalogue | N |
| comms | `POST /v1/families/:id/nudges` | Send buzz | N |
| comms | `POST /v1/nudges/:id/reply` | Reply (`coming`, `later`, `call`) | N |
| comms | `GET /v1/rtc/ice` | STUN/TURN credentials | N |
| comms | `GET /v1/families/:id/presence` | Online list | N |
| notifications | `GET /v1/inbox?cursor=`, `POST /v1/inbox/read`, `DELETE /v1/inbox` | Inbox | N |
| notifications | `GET/PUT /v1/me/notification-preferences` | Preferences | N |
| shopping | `GET/POST /v1/families/:id/shopping-lists`, `…/:listId/items` CRUD, `POST …/:listId/to-expense` | Bazaar list | N |
| lending | `GET/POST/PATCH/DELETE /v1/families/:id/dhar`, `POST …/:id/repayments` | Dhar | N |
| billing | `GET /v1/plans`, `GET /v1/families/:id/subscription`, `POST …/checkout`, `POST …/cancel`, `GET …/invoices` | Plans | N |
| billing | `POST /v1/webhooks/bkash`, `/nagad`, `/sslcommerz` | Gateway webhooks | N |
| platform | `GET /health`, `GET /ready`, `GET /v1/openapi.json`, `GET /v1/flags` | Ops | P (health only) |
| admin | `POST /admin/v1/auth/login`, `/totp`, `/logout`; `GET /admin/v1/me` | Staff session | N |
| admin | `GET /admin/v1/overview` | Overview metrics | N |
| admin | `GET /admin/v1/families`, `GET /admin/v1/families/:id` | Aggregates | N |
| admin | `POST /admin/v1/families/:id/{plan,quota,suspend,unsuspend,transfer-ownership,delete}` | Actions (reason required) | N |
| admin | `GET /admin/v1/privacy-requests`, `POST …/:id/{advance,reject}` | Privacy queue | N |
| admin | `GET /admin/v1/audit`, `GET /admin/v1/audit/export.csv` | Audit log | N |
| admin | `GET/POST/PATCH /admin/v1/staff` | Staff accounts | N |
| admin | `GET/PUT /admin/v1/plans`, `GET /admin/v1/health` | Plans and system health | N |

### 5.3 Contract generation and checks (DEC-17)
- Route schemas are declared with Zod (from `packages/shared`) through `fastify-type-provider-zod`; the API serves `/v1/openapi.json`.
- A build step writes `apps/api/openapi.json`; CI fails if the committed file differs from the generated one.
- A Dart contract test (`apps/mobile/test/contract/openapi_contract_test.dart`) loads `apps/api/openapi.json` and fixtures from `packages/shared/test-vectors/api/*.json`, and checks every Dart model decodes every fixture and every required field exists.
- Shared vectors already used: `hlc.json`. New vectors: money formatting, Bangla number words, SMS parser cases, API error shapes.

### 5.4 WebSocket protocol (`GET /v1/ws`)

- Auth: first client frame `{ "t":"auth", "token":"<access JWT>", "deviceId":"…", "familyId":"…" }` within 5 seconds, else the server closes with code 4401. A token near expiry can be refreshed in-band with `{ "t":"auth.refresh", "token":"…" }`.
- Heartbeat: client `{"t":"ping"}` every 25 s; server `{"t":"pong"}`; 60 s without a ping closes the socket and marks the device offline.
- Envelope: `{ "t":"<type>", "id":"<uuid>", "ts":"<iso>", ...payload }`. Unknown types are ignored. Every client→server message that changes state is acknowledged with `{ "t":"ack", "id":"<client id>" }` or `{ "t":"err", "id":…, "code":… }`.

| Direction | Type | Payload |
|---|---|---|
| S→C | `nudge` | `{ nudgeId, from, phraseId, phrase, intensity }` |
| S→C | `nudge.state` | `{ nudgeId, state: delivered\|seen\|replied, reply? }` |
| S→C | `msg` | full message object |
| S→C | `msg.receipt` | `{ conversationId, userId, upTo }` |
| S→C | `msg.deleted` | `{ messageId }` |
| S→C | `presence` | `{ userId, online }` |
| S→C | `typing` | `{ conversationId, userId }` |
| S→C | `inbox` | new notification item |
| S→C | `shopping.item` | item changed |
| S→C | `call.invite` / `call.cancel` / `call.accepted` / `call.rejected` / `call.offer` / `call.answer` / `call.ice` / `call.end` | WebRTC signalling |
| C→S | `typing`, `msg.read`, `call.*` (as above), `presence.hide` | — |

Only state-changing actions with a REST equivalent (send message, send buzz) go through REST so they work without a socket; the socket is for delivery and signalling.

### 5.5 Software interfaces
| Interface | Adapter | Dev/CI fake |
|---|---|---|
| Claude API (`@anthropic-ai/sdk`), model via `AI_MODEL` | `ai/infra/ClaudeClient` | Recorded-response fake |
| BD SMS gateway (SSL Wireless or Alpha SMS) | `identity/infra/SmsGateway` | In-memory store with test endpoint |
| FCM HTTP v1 | `notifications/infra/PushSender` | Fake sink with inspection endpoint |
| S3-compatible storage | `platform/storage` | MinIO container |
| coturn | `comms/infra/TurnCredentials` (HMAC) | coturn container |
| bKash, Nagad, SSLCommerz | `billing/infra/PaymentGateway` | Fake gateway server with webhooks |
| PostgreSQL 16 (Drizzle, pg-boss) | — | Container |

---

## 6. Data requirements

### 6.1 Ownership by module (Postgres schema = module name)

| Schema | Tables | State |
|---|---|---|
| `identity` | `users`, `sessions` (id, user_id, family_id_hash chain, refresh_hash, parent_id, device_id, created_at, expires_at, revoked_at), `otp_challenges` (phone_hash, code_hash, attempts, expires_at, ip), `consents` (user_id, kind, version, locale, accepted_at), `devices` (id, user_id, platform, fcm_token, app_version, locale, last_seen_at) | `users` exists; others new |
| `families` | `families` (+ `status`, `suspended_at`, `suspended_reason`), `family_members`, `family_invites` | exist; new columns |
| `ledger` | `accounts`, `categories`, `transactions` (+ `split_group_id`, `attachment_key`), `merchant_rules` (family_id, pattern, category_id, created_by) | mostly exist |
| `budgeting` | `budgets`, `festival_budgets`, `budget_alerts` (family_id, month, budget_id, threshold, fired_at) | `budget_alerts` new |
| `recurring` | `recurring_templates`, `recurring_skips` | `recurring_skips` new |
| `ai` | `ai_usage` (family_id, month, feature, requests, input_tokens, output_tokens, latency_ms_sum, errors), `ai_summaries` | extend `ai_usage` |
| `comms` | `conversations` (id, family_id, kind group/direct, key), `conversation_members` (conversation_id, user_id, last_read_message_id), `messages` (id, conversation_id, sender_id, kind text/voice/video/system, body, media_id, meta jsonb, created_at, deleted_at), `media` (id, family_id, kind, storage_key, bytes, duration_ms, owner_id, status, expires_at), `nudges` (id, family_id, sender_id, recipient_id, phrase_id, intensity, state, reply, created_at, delivered_at, seen_at, replied_at), `nudge_phrases` (id, text_bn, text_en, sort), `call_sessions` (id, family_id, initiator_id, started_at, ended_at, outcome), `call_participants` (call_id, user_id, joined_at, left_at, state) | new |
| `notifications` | `inbox_items` (id, user_id, family_id, kind, title, body, speech_text, data jsonb, created_at, read_at), `preferences` (user_id, kind flags, quiet_start, quiet_end, daily_reminder_time, hide_presence) | new |
| `shopping` | `lists` (id, family_id, name, archived_at), `items` (id, list_id, name, qty_text, est_price_paisa, added_by, checked_by, checked_at, position) | new |
| `lending` | `dhar` (id, family_id, direction, person_name, person_phone, amount_paisa, date, due_date, note, is_private, created_by, settled_at), `dhar_repayments` | new |
| `billing` | `plans`, `plan_limits`, `subscriptions`, `payments`, `invoices`, `webhook_events` (provider, event_id unique) | new |
| `privacy` | `requests` (id, user_id, kind export/erasure, status, step, requested_at, due_at, completed_at), `export_files` | new |
| `admin` | `staff_users` (id, email, password_hash, totp_secret_enc, role, locked_until, disabled_at), `staff_sessions`, `audit_log` (id, staff_id, action, target_type, target_id, family_id, reason, request_id, at, prev_hash, hash) | new |
| `platform` | `outbox`, `jobs` (pg-boss), `rate_limits`, `feature_flags`, `schema_migrations` | new |

### 6.2 Rules
- Money columns are `bigint` paisa. Dates are `timestamptz` (UTC); month keys are `YYYY-MM` in Asia/Dhaka.
- IDs are UUIDs (v7 for message and event ids so they sort by time).
- Every family-owned table has `family_id` and an index starting with it.
- No cross-schema foreign keys (DEC-02). Referential integrity across modules is guarded by facades and by a nightly job `platform.integrityCheck` that reports orphans to system health.
- Soft-deleted `transactions` keep `deleted_at` and are purged at 30 days (FR-PRIV-06); tombstones used by sync are kept for at least 30 days.
- Unique indexes: `transactions(family_id, trx_id)` where not null; `messages(conversation_id, client_id)`; `nudges` none; `webhook_events(provider, event_id)`; `family_invites(token)`; `staff_users(lower(email))`.

---

## 7. AI subsystem

Unchanged in behaviour from v0.2 §6 (parse pipeline, summary with placeholders, Ask with read-only tools, privacy stripping of phone numbers). Changes:

1. Lives in module `ai`; it gets the family's categories through `ledger.listCategories()` and quota through `billing.entitlements()`.
2. **Merchant rules** (FR-AI-07) are applied after the SMS and quick parsers and before the LLM: `ledger.matchMerchantRule(familyId, text)`.
3. **Usage metering** (FR-AI-14) wraps every Claude call and writes tokens, latency and outcome.
4. **Cost guard** (FR-AI-15): daily ceiling check before the call; over the ceiling returns `429 ai_quota` the same way as monthly exhaustion.
5. The parse response includes `ruleApplied` so the app can show "শপনো → বাজার (আপনার নিয়ম)".
6. The receipt endpoint also returns per-line category suggestions for splits (FR-TXN-08).
7. Voice notes and chat are never sent to the AI (FR-VNOTE-05). Ask only reads ledger aggregates and non-private transactions.

---

## 8. Communication design (module `comms`, `notifications`)

### 8.1 Buzz flow
```
Sender app ──POST /v1/families/:id/nudges──► comms.sendNudge
   • check family not suspended, rate limits (FR-NUDGE-05), recipients are members
   • insert nudges row (state=sent) + publish comms.NudgeSent.v1 (outbox)
   • for each recipient:
       live socket?  yes → ws {t:"nudge"} → state=delivered, push skipped
                     no  → notifications.PushSender.sendData(high priority) → app wakes
   Recipient app (foreground or FCM background handler):
       1. quiet hours? no → vibrate(pattern) + play TTS phrase
       2. show full-screen card (screen 6) or heads-up notification (channel "nudge")
       3. POST seen → nudge.state=seen → sender gets ws {t:"nudge.state"}
       4. reply আসছি/পরে বলছি/ফোন করি → POST /v1/nudges/:id/reply → sender is notified; a chat event is created
```
Android 14+ requires the user to allow full-screen intents for incoming calls; if not allowed, the app falls back to a heads-up notification with the same vibration pattern on the `nudge`/`calls` channel and shows a one-time guide screen to enable it (FR-NUDGE-08).

### 8.2 Chat flow
- `POST /v1/conversations/:id/messages {id, body}` stores the message (unique on `client_id`), publishes `comms.MessageSent.v1`, fans out over sockets, and enqueues push for recipients without sockets (body truncated to 80 chars; for voice/video the push says only "ভয়েস মেসেজ"/"ভিডিও").
- Read receipts: `POST /v1/conversations/:id/read {upTo}` updates `last_read_message_id` and emits `msg.receipt`.
- History: `GET …/messages?cursor=` returns newest first, 50 per page. The mobile app stores the last 500 per conversation in Drift (`messages`, `conversations`, `outbox_messages`).
- System cards are inserted by event handlers (`ledger.TransactionCreated` non-private → "আম্মু খরচ লিখেছেন: বাজার ৳ ৮৫০", `comms.CallEnded` → call card).

### 8.3 Media (voice notes, video messages)
1. Client `POST …/voice-notes {durationMs, bytes, mime}`; server checks limits (≤ 60 s, ≤ 600 KB, mime in the accepted list of FR-VNOTE-02; video ≤ 30 s, ≤ 8 MB), creates `media(status=pending)` and returns a presigned `PUT` URL valid 10 minutes.
2. Client uploads, then `POST /v1/voice-notes/:id/confirm`; server verifies the object size with a `HEAD`, flips status to `ready`, and creates the message.
3. Playback uses `GET /v1/media/:id` → a presigned `GET` valid 5 minutes. Access is checked against conversation membership each time.
4. A daily job deletes media past `expires_at` (180 days) and orphan `pending` rows older than 1 hour.

### 8.4 Video calls
1. Caller opens a call: `call.invite` over the socket (or `POST` fallback) creates `call_sessions` and rings recipients (socket or FCM data, 45-second timeout).
2. Accepting side sends `call.accept`; caller creates the offer, sends `call.offer`; callee replies `call.answer`; both exchange `call.ice`.
3. ICE servers come from `GET /v1/rtc/ice`: `stun:` and `turn:`/`turns:` URLs, username `<expiry>:<userId>`, credential `base64(HMAC-SHA1(secret, username))`, TTL 3600 s.
4. Mesh for up to 4: each pair negotiates independently; the UI shows a grid of up to 4 tiles.
5. Call end: either side sends `call.end`; the server writes the outcome (`completed`, `missed`, `declined`, `busy`, `failed`) and a chat card.

### 8.5 Low-bandwidth behaviour
- Calls start at 360p/15 fps (max 400 kbps video), degrade to 240p, then audio-only when packet loss > 15% for 5 s; `getStats()` is sampled every 2 s.
- Voice notes are 32 kbps; video messages are 360p H.264 at ≤ 600 kbps; media auto-download only on Wi-Fi (setting).
- Socket reconnect uses exponential back-off with jitter (1 s → 30 s). Messages and nudges missed while offline are fetched by cursor on reconnect.

---

## 9. Ledger sync (module `sync`)

The sync design of v0.2 §4.3.1 stands and is already implemented on both sides (`apps/api/src/routes/sync.ts`, `apps/mobile/lib/data/sync/*`):

- `POST /v1/families/:id/sync` body `{ nodeId, cursor, changes: { transactions: [...] } }`; response `{ cursor, more, applied, rejected, changes }`.
- Cursor is a **delivery sequence** (`sync_seq`), not an HLC. HLC decides which version of a record wins; ties break by `nodeId`.
- Deletes are tombstones kept at least 30 days; pushes are idempotent; HLCs more than 24 hours ahead of server time are rejected (`clock_drift`); private rows return only to their creator; viewers neither push nor receive individual rows.
- Rejection reasons: `invalid`, `unknown_reference`, `duplicate_trx_id`, `forbidden`, `id_taken`.

Additions in v1.0:
1. **Scope**: only `transactions` use HLC sync (DEC-14). Reference data (categories, accounts, budgets, members, entitlements) is pulled read-only on each sync (FR-SYNC-08). The existing mobile cache of categories and accounts is extended with budgets, members and entitlements.
2. **Background scheduling** (FR-SYNC-06) and **status UI** (FR-SYNC-07).
3. The module registers `ledger` events so web and REST writes stamp HLC and bump `sync_seq` through the same function (`ledger.stampChange`).
4. Chat, nudges, shopping lists and dhar are **not** HLC-synced. Shopping lists use REST + WebSocket with last-write-wins per item (`updated_at`), because list edits are tiny and server-authoritative (DEC-14).

---

## 10. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Performance | p95 API latency ≤ 300 ms for CRUD; ≤ 4 s AI text parse; ≤ 8 s receipt parse |
| NFR-02 | Performance | Mobile cold start ≤ 3 s on a mid-range Android phone (Redmi, Samsung A-series) |
| NFR-03 | Data use | Typical session ≤ 200 KB excluding media; images ≤ 300 KB before upload; chat text frames ≤ 2 KB |
| NFR-04 | Availability | 99.5% monthly for the API; single instance supports ≥ 5,000 active families and ≥ 2,000 concurrent WebSockets |
| NFR-05 | Security | TLS 1.2+; OWASP ASVS L2; Argon2id for staff passwords; OTP limits (FR-AUTH-07); per-user and per-IP rate limits on every route group |
| NFR-06 | Security | Tenant isolation: every query is scoped by `family_id`. An **automatic** test iterates every route in the OpenAPI document and proves a user from family B gets 404 on family A's resources (§11.2) |
| NFR-07 | Privacy | PDPO 2025: consent, export and deletion within 30 days, record of processing, breach process, disclosure of cross-border AI processing, data minimisation |
| NFR-08 | Reliability | Daily database backups kept 14 days; an automated weekly restore test into a scratch database; result visible in system health |
| NFR-09 | Localisation | 100% string coverage in bn and en, checked by a test that compares ARB/catalogue keys and fails on missing or unused keys. Bangla copy also matches the design: `docs/design/strings.json` (generated by `tools/design/extract-strings.mjs`) is compared with the app strings (T-MOB-77, T-WEB-42) |
| NFR-10 | Accessibility | WCAG 2.1 AA; screen-reader labels on all actions; semantics tests for every screen |
| NFR-11 | Maintainability | TypeScript strict; ≥ 80% line coverage on module `domain/` and `app/` folders, ≥ 70% on `packages/*`; Flutter: `flutter analyze` with zero issues (blocking) and ≥ 70% coverage of `lib/domain`, `lib/data`, `lib/core`; CI runs lint, typecheck, tests, architecture checks |
| NFR-12 | Observability | Structured pino logs with PII redaction (phones, tokens, message bodies); request ids; Prometheus-format `/metrics` (protected); error tracking hook; AI usage metrics per family |
| NFR-13 | Cost | AI cost ≤ ৳15 per active family per month; storage cost alarm if media bytes per family exceed 500 MB |
| NFR-14 | Voice | Speech recognition and TTS on the device; entry → read-back ≤ 3 s p95 when the offline parser handles it |
| NFR-15 | Voice accuracy | ≥ 85% of voice entries saved without editing the amount (post-launch measurement, including Sylheti and Chattogram speakers) |
| NFR-16 | Accessibility | Bangla accessibility labels on every interactive element; primary buttons ≥ 56 dp |
| NFR-17 | Realtime | Buzz delivered to a connected recipient within 2 s p95; via FCM within 8 s p95 (online device); chat message fan-out ≤ 1 s p95 |
| NFR-18 | Calls | Call setup (accept → media flowing) ≤ 5 s p95 on 4G; audio-only keeps working at 40 kbps; ≥ 95% of calls complete without TURN failure in the test harness |
| NFR-19 | Storage | Voice note ≤ 300 KB per minute; video message ≤ 8 MB per 30 s; presigned URLs expire in ≤ 10 minutes |
| NFR-20 | Delivery | Every task in the backlog has automated acceptance checks; CI total time ≤ 20 minutes; `docker compose up` reaches healthy in ≤ 3 minutes on a clean machine |
| NFR-21 | Architecture | `dependency-cruiser` and the architecture test pass; no module-internal import crosses a module boundary; no schema table referenced outside its module |
| NFR-22 | App size | Release APK ≤ 35 MB per ABI split |
| NFR-23 | Admin security | Staff TOTP mandatory; audit log hash chain verifiable by an automated check; staff API returns no field marked `family-private` (§11.3) |
| NFR-24 | UI fidelity | Golden screenshot tests for each design screen with tolerance ≤ 2% pixel difference at 390×844 (mobile) and 1280×800 (admin), run in CI on the pinned Flutter/Next versions |

---

## 11. Security and privacy design

### 11.1 Authentication and authorisation
- Access JWT: 15 minutes, `typ=access`, claims `sub`, `sid` (session id). Refresh token: opaque 256-bit random, stored as SHA-256 hash in `identity.sessions`, one use per rotation; reuse of a rotated token revokes the whole session chain.
- Family authorisation uses `families.requireRole(familyId, userId, minRole)` (non-members get 404). Suspended families return `423 family_suspended` on write routes.
- Staff JWT is a different audience (`aud=admin`), 30-minute sliding expiry, and cannot be used on `/v1/*` (and vice versa).
- WebSocket authorisation is re-checked on every family-scoped message; leaving a family closes its subscriptions immediately.

### 11.2 Automatic tenant-isolation test
`apps/api/src/security/tenant-isolation.test.ts` reads `openapi.json`, creates two families with users, creates one resource per route group, and for every route containing `:familyId`, `:conversationId`, `:messageId`, `:mediaId` or similar, calls it as an outsider and expects 404 (never 200/403/500). New routes are covered automatically; a route that has no fixture fails the test until a fixture is added.

### 11.3 Staff data boundary (DEC-18)
- Only facades marked with the JSDoc tag `@staff-safe` may be imported by `admin`. A custom ESLint rule checks that `@staff-safe` functions return types that do not contain fields named in `packages/shared/src/private-fields.ts` (`amountPaisa`, `note`, `counterparty`, `body`, `mediaId`, `phone`, `trxId`, …).
- Phones appear to staff only as `•••` plus the last 3 digits.
- A test crawls every `/admin/v1` response (using seeded data containing sentinel strings) and fails if any sentinel appears.

### 11.4 PDPO mapping
| PDPO need | Implementation |
|---|---|
| Consent | FR-AUTH-10, FR-VNOTE-04, versioned |
| Access and portability | FR-PRIV-03 export |
| Erasure | FR-PRIV-04 |
| Minimisation | AI privacy stripping (§7), no raw SMS or receipt text stored, staff aggregates only |
| Cross-border | Disclosure on `A2` and in the policy; AI calls send no names or full phone numbers |
| Processing record | FR-PRIV-07 generated document |
| Breach handling | Runbook file `docs/runbooks/breach.md` checked for existence by CI; audit log and health metrics support investigation |

### 11.5 Abuse and limits
| Area | Limit |
|---|---|
| OTP | FR-AUTH-07 |
| Buzz | 3 per minute and 20 per hour per sender→recipient |
| Messages | 60 per minute per user; 2,000 characters |
| Media | 60 s voice, 30 s video; 40 uploads per user per day |
| Calls | 10 invites per hour per user |
| API general | 300 requests per minute per user; 60 per minute per IP for unauthenticated routes |
| AI | Plan quota and daily ceiling (FR-AI-12, -15) |

---

## 12. Implementation gap register

Built by reading the repository at commit `e2ef7bc` (API, shared packages, web, mobile, CI, Compose). "Evidence" names the file or fact. **Closed by** gives the task area in `docs/tasks/`; the detailed task IDs are in those files. Severity: **H** blocks a P1 requirement or the architecture, **M** blocks P2/P3 or quality, **L** polish.

### 12.1 Corrections to earlier statements
1. SRS v0.2 said FR-SYNC-05 (server sync) was "not yet built". It **is** built: `apps/api/src/routes/sync.ts` and `apps/mobile/lib/data/sync/sync_service.dart` (with tests). Remaining work is background scheduling and the status UI.
2. The API already implements: receipts (`/ai/receipt`), Ask (`/ai/ask`), recurring templates with drafts and reminders, festival budgets, remittance report, CSV export, invites, member management, and report breakdowns by member and account. What is missing is mostly UI, quotas of quality, and the new modules.

### 12.2 Architecture and platform

| Gap | Evidence | Sev | Closed by |
|---|---|---|---|
| GAP-ARCH-01 Backend is not a modular monolith | Flat `apps/api/src/routes/*.ts`, one `db/schema.ts` (208 lines) for all tables, an `AppDeps` bag passed to routes, no boundary rules | H | T-PLAT |
| GAP-ARCH-02 No migrations | Compose runs `drizzle-kit push --force`; no migration files | H | T-PLAT |
| GAP-ARCH-03 No event bus, outbox or job queue | No such code; budgets/recurring have no scheduler | H | T-PLAT |
| GAP-ARCH-04 No realtime channel | No WebSocket code in the API | H | T-PLAT, T-COMM |
| GAP-ARCH-05 No object storage | Receipt endpoint parses and discards images | M | T-PLAT |
| GAP-ARCH-06 No rate limiting, request ids, metrics or readiness probe | `/health` only; `app.ts` registers only CORS and JWT | H | T-PLAT |
| GAP-ARCH-07 No OpenAPI or contract checks; mobile mirrors the API by hand | `api_client.dart` hand-written; no spec file | M | T-PLAT, T-MOB |
| GAP-ARCH-08 No feature flags | none | M | T-PLAT |
| GAP-ARCH-09 DB-backed API tests are a TODO; `scripts/e2e.mjs` is a manual script outside CI | `app.test.ts` comment; CI runs `pnpm test` only | H | T-PLAT |
| GAP-ARCH-10 CI gaps | Flutter `analyze` is `continue-on-error`; Drift `*.g.dart` generated in CI only; no coverage thresholds; Docker job skipped when no Dockerfile; no web/admin e2e; no golden tests | M | T-PLAT |
| GAP-ARCH-11 No fakes for external services | SMS, FCM, S3, TURN, payments, Claude have no adapters | H | T-PLAT |
| GAP-ARCH-12 Required runbooks missing | no `docs/runbooks` | L | T-PLAT |

### 12.3 Backend functional gaps

| Gap | Evidence | Sev | Closed by |
|---|---|---|---|
| GAP-ID-01 OTP store is in memory; no SMS gateway; no resend gap or rate limits | `otp.ts` TODO; `routes/auth.ts` returns `devCode` | H | T-ID |
| GAP-ID-02 Refresh tokens are stateless JWTs; no rotation, revocation or logout | `routes/auth.ts` TODO | H | T-ID |
| GAP-ID-03 `/v1/me` is read-only; no profile update (name, locale, numerals, Simple mode, reminder time) | `routes/auth.ts` | H | T-ID |
| GAP-ID-04 No consent records, policy endpoint, device registry | none | H | T-ID, T-PRIV |
| GAP-ID-05 No account deletion or export | none (FR-AUTH-05, NFR-07) | H | T-PRIV |
| GAP-FAM-01 No ownership transfer, orphan handling, suspension, plan member limits | `routes/invites.ts`, `families.ts` | M | T-FAM |
| GAP-FAM-02 Phone invites are not delivered (no SMS, no push) | `invites.ts` stores phone only | M | T-FAM, T-NOTIF |
| GAP-LED-01 Transaction list has no cursor and no filters by category/member/account (limit 200) | `routes/transactions.ts` TODO | H | T-LED |
| GAP-LED-02 No single-transaction GET, no restore, no purge job | `transactions.ts` | H | T-LED, T-PRIV |
| GAP-LED-03 No receipt attachment storage, no split groups | schema has neither | M | T-LED |
| GAP-LED-04 No merchant rules | no table (FR-AI-07) | M | T-LED, T-AI |
| GAP-LED-05 Account balances not returned (FR-ACC-03) | accounts GET | M | T-LED |
| GAP-BUD-01 No alert engine: budgets compute spent on read but nothing fires 80%/100% | `routes/budgets.ts` | H | T-BUD |
| GAP-BUD-02 Budget carry-forward on the 1st not scheduled (to be verified in task T-BUD-03 against the existing behaviour) | no scheduler | M | T-BUD |
| GAP-REC-01 Recurring reminders are readable but never pushed; no skip | `routes/recurring.ts` | M | T-REC, T-NOTIF |
| GAP-AI-01 `ai_usage` stores request counts only (no feature, tokens, latency, errors) | `db/schema.ts` | M | T-AI |
| GAP-AI-02 No daily cost ceiling | `routes/ai.ts` | M | T-AI |
| GAP-REP-01 No 6/12-month trend endpoint | `routes/reports.ts` | M | T-REP |
| GAP-REP-02 Aggregate queries do not use a shared "visible to caller" helper across modules | duplicated `or(isPrivate=false, createdBy=user)` in 5 files | M | T-REP, T-LED |
| GAP-SYNC-01 Sync covers transactions only; budgets, members, entitlements are not delivered for offline use | `sync.ts` | M | T-SYNC |
| GAP-NOT-01 No FCM, device tokens, inbox, preferences, scheduler | none (FR-NOT-01..08) | H | T-NOTIF |
| GAP-COMM-01 No communication module (buzz, chat, voice, video, presence) | none | H | T-COMM |
| GAP-SHOP-01 / GAP-LEND-01 No shopping or dhar modules | none | M | T-SHOP, T-LEND |
| GAP-BILL-01 No plans, subscriptions, payments, entitlements beyond `families.plan` text and `ai_quota_month` | `db/schema.ts` | M | T-BILL |
| GAP-PRIV-01 No retention jobs; no export or erasure workflows | none | H | T-PRIV |
| GAP-ADM-01 No staff accounts, audit log, admin API, system health | none | H | T-ADM |

### 12.4 Mobile gaps (`apps/mobile`)

| Gap | Evidence | Sev | Closed by |
|---|---|---|---|
| GAP-MOB-01 Navigation is `MaterialPageRoute` with 8 routes; no tabs, no deep links | `app_router.dart` | H | T-MOB |
| GAP-MOB-02 Dashboard uses a local `Role {father, mother, child}` and a default `monthlyBudget = 100000`, not the server roles or budgets | `enums.dart`, `providers.dart` | H | T-MOB |
| GAP-MOB-03 Money held as `double` in app state (`addExpense(double taka)`) | `providers.dart` | M | T-MOB |
| GAP-MOB-04 Strings are hard-coded and mixed English/Bangla; no l10n; no numeral setting | `settings_screen.dart`, `dashboard_screen.dart` | H | T-MOB |
| GAP-MOB-05 Screens that exist: onboarding, login, dashboard, transaction, AI entry, settings, tutorial, pending SMS (8). Screens missing from the design: see §5.1.3 (44 of 52) | `lib/presentation/screens` | H | T-MOB |
| GAP-MOB-06 No push, notification channels, vibration, full-screen intent; manifest lacks `POST_NOTIFICATIONS`, `VIBRATE`, `USE_FULL_SCREEN_INTENT`, `CAMERA` | `AndroidManifest.xml`, `pubspec.yaml` | H | T-MOB |
| GAP-MOB-07 No audio recording or playback, camera, video, WebRTC | `pubspec.yaml` | H | T-MOB |
| GAP-MOB-08 Local store has no tables for budgets, members, entitlements, messages, conversations, nudges, shopping, dhar | `tables.dart` | H | T-MOB |
| GAP-MOB-09 Sync runs only when the user taps a button; no WorkManager job | `settings_screen.dart` | M | T-MOB |
| GAP-MOB-10 Spoken budget alert logic exists with no screen, scheduler or trigger | `budget_alerts.dart` | M | T-MOB |
| GAP-MOB-11 No Simple mode, no accessibility labels audit, no golden tests | none | M | T-MOB |
| GAP-MOB-12 Refresh-token handling absent: only an access token is stored (in `shared_preferences`, unencrypted) | `auth_provider.dart` | H | T-MOB |
| GAP-MOB-13 No consent step, no family-create/join UI path verified end to end | `onboarding_screen.dart` | M | T-MOB |
| GAP-MOB-14 No contract test with the API; `*.g.dart` not committed | CI step | M | T-MOB, T-PLAT |

### 12.5 Web gaps (`apps/web`)

| Gap | Evidence | Sev | Closed by |
|---|---|---|---|
| GAP-WEB-01 One 675-line `app/page.tsx`; no routes, layouts or components | `apps/web/app/page.tsx` | H | T-WEB |
| GAP-WEB-02 Token kept in `localStorage`, no refresh | `loadToken`/`saveToken` | H | T-WEB |
| GAP-WEB-03 Present: login, create family, quick add with voice, dashboard with tabs, accounts/categories lists, members and invite, budgets, spoken summary, invite acceptance by `?invite=`. Missing: transaction list/edit/delete, receipts, Ask, recurring, festival, reports pages, export button, notifications, comms, shopping, profile, delete account, plans | `page.tsx` | H | T-WEB |
| GAP-WEB-04 No tests, no e2e | no test files in `apps/web` | M | T-WEB, T-PLAT |
| GAP-WEB-05 No push or realtime (service worker, WebSocket) | none | M | T-WEB |
| GAP-ADMUI-01 No admin console app | none | H | T-ADMUI |

### 12.6 Documentation gaps
| Gap | Closed by |
|---|---|
| GAP-DOC-01 BRD v0.2 had no business requirements for communication, admin console, shopping list and privacy workflows. **Closed:** BRD v0.3 adds BR-25..BR-30 (§14.2); T-PLAT-34 keeps the docs checker green |
| GAP-DOC-02 SRS v0.2 stale (FR-SYNC-05 status, API table) | this document |

---

## 13. Delivery plan

### 13.1 Milestones and exit criteria
All exit criteria are commands. A milestone is complete when its command set passes in CI; no meeting is needed to start the next one.

| M | Name | Contents (task areas) | Exit command |
|---|---|---|---|
| M0 | Foundation | `T-PLAT`: modular monolith skeleton and boundary rules, migrations, platform services, fakes, test infrastructure, OpenAPI, CI hardening | `pnpm verify:m0` (typecheck, tests with real Postgres, architecture checks, openapi drift, compose smoke) |
| M1 | Identity and families | `T-ID`, `T-FAM`, `T-NOTIF` (inbox + devices + FCM sender), mobile auth and navigation shell | `pnpm verify:m1` plus `flutter test` |
| M2 | MVP ledger complete | `T-LED`, `T-BUD`, `T-AI` (metering), `T-REP`, `T-MOB` (home, add, list, detail, budgets, summary, i18n), `T-WEB` (routes, list, reports) | `pnpm verify:m2`, e2e scenarios AC-01..AC-14 |
| M3 | Family communication I | `T-COMM` buzz, chat, presence, voice notes; `T-NOTIF` channels and quiet hours; mobile and web UIs | `pnpm verify:m3`, AC-15..AC-22 |
| M4 | Offline and accessibility | `T-SYNC`, background sync, sync UI, Simple mode, tutorial, voice fallback, goldens | `pnpm verify:m4`, AC-23..AC-26 |
| M5 | Privacy and admin | `T-PRIV`, `T-ADM`, `T-ADMUI` | `pnpm verify:m5`, AC-27..AC-31 |
| M6 | Video | `T-COMM` calls and video messages; `T-MOB` WebRTC | `pnpm verify:m6`, AC-32..AC-34 |
| M7 | AI and ledger P2 | merchant rules, receipt attachments and splits, Ask UI, recurring and festival UIs, trends, shopping | `pnpm verify:m7`, AC-35..AC-38 |
| M8 | Growth | `T-BILL`, `T-LEND`, plans UI, Excel/PDF export | `pnpm verify:m8`, AC-39..AC-41 |

`pnpm verify:mN` is a root script created in `T-PLAT` that runs the exact commands for milestone N and exits non-zero on any failure.

### 13.2 Task backlog
Each file lists tasks with: ID, title, why (requirements and gaps closed), depends on, exact files to create or change, step-by-step implementation, data and API contract, tests to write, automated acceptance commands, and the definition of done. Template and conventions: `docs/tasks/README.md`.

| File | Areas |
|---|---|
| `docs/tasks/01-platform.md` | T-PLAT |
| `docs/tasks/02-backend-core.md` | T-ID, T-FAM, T-LED, T-BUD, T-REC, T-AI, T-REP, T-SYNC |
| `docs/tasks/03-backend-engage.md` | T-COMM, T-NOTIF, T-SHOP, T-LEND, T-BILL, T-PRIV, T-ADM |
| `docs/tasks/04-mobile.md` | T-MOB |
| `docs/tasks/05-web-admin.md` | T-WEB, T-ADMUI |

---

## 14. Traceability

### 14.1 BRD → SRS
| BR | Covered by |
|---|---|
| BR-01, BR-02 | FR-AUTH-01..11, FR-FAM-01..10 |
| BR-03 | FR-AI-01, -03..06, FR-TXN-09 |
| BR-04 | FR-AI-02, FR-TXN-04 |
| BR-05 | FR-ACC-01..04 |
| BR-06 | FR-CAT-01..03 |
| BR-07 | FR-BUD-01..07, FR-NOT-01 |
| BR-08 | FR-REP-01..03, FR-REP-05 |
| BR-09 | §5.1, FR-I18N-01 |
| BR-10 | FR-AI-08, FR-VOICE-01..03, FR-AI-13 |
| BR-11 | FR-AI-09, FR-TXN-07, -08 |
| BR-12 | FR-AI-10 |
| BR-13 | FR-FAM-05, FR-REP-05, FR-VIDEO-01 (stay connected) |
| BR-14 | FR-SYNC-01..08 |
| BR-15 | FR-REC-01..03, FR-NOT-03 |
| BR-16 | FR-TXN-05, FR-REP-06 |
| BR-17 | FR-BILL-01..07 |
| BR-18 | FR-LEND-01..04 |
| BR-19 | FR-REP-04, FR-AI-11 |
| BR-20 | FR-AUTH-05, -10, FR-PRIV-01..07, NFR-07 |
| BR-21 | FR-AI-11 |
| BR-22 | FR-VOICE-04, -05 |
| BR-23 | FR-VOICE-03, -06, -07, -09, -10, §5.1.2 |
| BR-24 | FR-VOICE-08, FR-AI-10 |

### 14.2 Additions made in BRD v0.3
| BR | Requirement | Priority | Phase | Covered by |
|---|---|---|---|---|
| BR-25 | Family members can reach each other inside the app by vibration buzz, text, voice notes, video messages and video calls | Must | 1–2 | FR-NUDGE, FR-CHAT, FR-VNOTE, FR-VMSG, FR-VIDEO, FR-PRES |
| BR-26 | Staff can manage families, plans, privacy requests and system health without seeing family money or conversations | Must | 2 | FR-ADM-01..11 |
| BR-27 | Families can keep a shared bazaar list that turns into an expense | Should | 2 | FR-SHOP-01..04 |
| BR-28 | The app works offline, shows its sync state in plain words, and notifies by push and inbox | Must | 1–2 | FR-SYNC-06..08, FR-NOTIF-04..08 |
| BR-29 | A Simple mode makes the app usable with one big button and spoken results | Should | 2 | FR-VOICE-09, FR-HOME-01 |
| BR-30 | Users can export and erase their own data | Must | 1 | FR-PRIV-03, -04 |

### 14.3 Requirement → module → tasks (summary)
| Requirement group | Module | Task area |
|---|---|---|
| FR-AUTH, FR-NOTIF-04..07 (devices) | identity, notifications | T-ID, T-NOTIF |
| FR-FAM | families | T-FAM |
| FR-ACC, FR-CAT, FR-TXN | ledger | T-LED |
| FR-BUD | budgeting | T-BUD |
| FR-REC | recurring | T-REC |
| FR-AI | ai | T-AI |
| FR-REP | reporting | T-REP |
| FR-SYNC | sync, mobile | T-SYNC, T-MOB |
| FR-NUDGE, FR-CHAT, FR-VNOTE, FR-VMSG, FR-VIDEO, FR-PRES | comms | T-COMM |
| FR-SHOP, FR-LEND, FR-BILL | shopping, lending, billing | T-SHOP, T-LEND, T-BILL |
| FR-PRIV | privacy | T-PRIV |
| FR-ADM | admin | T-ADM, T-ADMUI |
| FR-VOICE, FR-ONB, FR-A11Y, FR-I18N, FR-NAV, FR-HOME | clients | T-MOB, T-WEB |

---

## 15. Acceptance criteria (all automated)

Layer key: **API** = Vitest against a real PostgreSQL and fakes; **MOB** = `flutter test` (widget/integration, golden); **WEB** = Playwright on `apps/web`; **ADM** = Playwright on `apps/admin`; **ARCH** = dependency-cruiser and architecture tests.

| ID | Scenario | Layer |
|---|---|---|
| AC-01 | Two members on different devices each log an expense and both see the same month total within 5 seconds | API + MOB |
| AC-02 | *"আজ বাজারে ৮৫০ টাকা দিলাম ক্যাশে"* → draft: expense, ৳850, Bazaar & Groceries, Cash, today | API |
| AC-03 | A real bKash Send Money SMS fixture → amount, fee, masked recipient, TrxID, time, **no AI call** (call counter = 0) | API |
| AC-04 | Posting the same SMS twice returns 409 `duplicate_trx_id` the second time | API |
| AC-05 | A ৳10,000 Bazaar budget fires exactly one 80% alert and one 100% alert per month | API |
| AC-06 | Every screen renders in bn and en with no missing keys (key-diff test) | MOB + WEB |
| AC-07 | A Member editing another member's transaction gets 403; any route with another family's id returns 404 (auto-generated tenant test) | API |
| AC-08 | *"আজ বাজারে আটশো পঞ্চাশ টাকা ক্যাশে"* produces a ৳850 draft with no AI call and the read-back text equals the expected Bangla sentence | MOB |
| AC-09 | *"পাঁচশো টাকা দিলাম"* produces ৳500 with no category and the picker screen (A4) appears | MOB |
| AC-10 | Monthly summary text shows ৳ amounts; speech text shows the same amounts in words; any model output with a digit outside placeholders is rejected | API |
| AC-11 | In Simple mode, the add-expense-by-voice flow and the summary Listen flow complete using only elements ≥ 72 dp, each with a Bangla label | MOB |
| AC-12 | OTP: 6th wrong try returns `otp_invalid` with `attemptsLeft=0`; the 6th code request in an hour returns `otp_rate_limited`; the A7 screen shows the Bangla message | API + MOB |
| AC-13 | Refresh rotation: a reused refresh token revokes the session; logout revokes; the app shows F6 and returns to the same screen after login | API + MOB |
| AC-14 | Transaction list: 120 rows, filters by member and account, cursor pagination gives exactly 3 pages with stable order; deleting then restoring within 30 days returns the row | API |
| AC-15 | Buzz: a connected recipient receives `nudge` within 2 s and state moves `sent → delivered → seen → replied`; a recipient with no socket gets an FCM data message in the fake sink | API |
| AC-16 | Buzz rate limits return 429 after 3 in a minute; quiet hours suppress vibration but keep the inbox item | API + MOB |
| AC-17 | On the Android test harness (`integration_test`), receiving a buzz data message triggers the recorded vibration pattern for the chosen intensity and shows screen 6 | MOB |
| AC-18 | Chat: sending with the same client id twice stores one message; receipts update; offline messages send in order on reconnect | API + MOB |
| AC-19 | Chat cards: a non-private expense creates a card; a private one does not | API |
| AC-20 | Voice note: presigned upload to MinIO, confirm, playback URL works only for conversation members and expires in ≤ 5 minutes | API |
| AC-21 | Voice note over 60 s or 600 KB is rejected before upload | API |
| AC-22 | Presence: online/offline changes appear within 3 s and are hidden when the user opts out | API |
| AC-23 | Background sync: after a local write offline, regaining connectivity syncs within 20 s without opening the app screen (WorkManager test) | MOB |
| AC-24 | Two devices with conflicting edits converge to the greater HLC; results equal peer-to-peer merge (shared vectors) | MOB + API |
| AC-25 | Offline status screen shows pending count and last sync in words | MOB |
| AC-26 | Golden tests for D1, D2, D3 and F4 match within 2% | MOB |
| AC-27 | Export: a request produces a ZIP in storage within 60 s in tests; it contains the user's own data and nothing from others | API |
| AC-28 | Erasure: after the grace period, the user's sessions, devices, inbox, media and messages are removed or redacted, their transactions remain with `createdBy` anonymised, and `UserErased` handlers ran in every module | API |
| AC-29 | Admin sign-in requires TOTP; 5 wrong attempts lock for 15 minutes; staff token fails on `/v1/*` | API + ADM |
| AC-30 | Admin actions without a reason, or deletes without `confirmFamilyName`, are rejected; successful actions append an audit entry whose hash chain verifies | API + ADM |
| AC-31 | Staff data boundary: crawl of all `/admin/v1` responses with sentinel data finds no private field | API |
| AC-32 | Two test clients complete a 1:1 call through the fake TURN server and exchange media tracks; invalid TURN credentials fail closed | MOB + API |
| AC-33 | Incoming call rings via FCM data when the callee has no socket, times out after 45 s as `missed` | API |
| AC-34 | Packet-loss simulation drops to audio-only and recovers | MOB |
| AC-35 | Merchant rule: after confirming a rule, the next parse of the same merchant uses it with no AI call | API |
| AC-36 | Receipt photo with three lines creates a split group whose children sum to the parent | API |
| AC-37 | Shopping: item changes reach a second client in ≤ 1 s; "to expense" creates a draft with the sum | API |
| AC-38 | Trend endpoint returns 6 and 12 month series with zeros for empty months | API |
| AC-39 | Checkout: a fake bKash payment activates Plus; a replayed webhook changes nothing | API |
| AC-40 | Downgrade: Free limits become read-only features without data loss | API |
| AC-41 | Dhar: partial repayments derive status; settled entries do not appear in spending reports | API |
| AC-42 | ARCH: no cross-module internal imports, no cycles, no cross-schema foreign keys, every module has `index.ts`, `schema.ts`, `events.ts` | ARCH |

---

## Appendix A. Glossary additions
| Term | Meaning |
|---|---|
| Buzz | A vibration nudge with a preset phrase, sent between family members |
| Dhar | Informal loan between people |
| Facade | The public surface of a backend module |
| Outbox | Table that records events in the same transaction as the change |
| Staff-safe | A facade function that returns only aggregates |
| Simple mode | A layout with one big action and spoken results |
