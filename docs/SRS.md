# Amar Poribar — Software Requirements Specification (SRS)

| Item | Value |
|---|---|
| Version | 0.1 (draft) |
| Date | 2026-10-06 |
| Based on | [BRD v0.1](./BRD.md) |
| Structure | Adapted from IEEE 830 / ISO/IEC/IEEE 29148 |

---

## 1. Introduction

### 1.1 Purpose
This SRS specifies the software requirements for Amar Poribar, a family expense tracker for Bangladesh with AI-assisted entry. It is written for the developers, testers and the product owner.

### 1.2 Scope
The system has three parts:
- a **REST API** backend,
- a **web app** (dashboard and entry),
- an **Android mobile app** (React Native / Expo; iOS later).

All three share TypeScript packages for domain types, validation and AI logic in **one monorepo**. Requirements are tagged with their phase (P1 = MVP, P2 = v1, P3 = growth) as defined in BRD §5.

### 1.3 Definitions
See BRD §12. In addition:
- **Draft**: an AI- or parser-generated transaction that waits for user confirmation.
- **Paisa**: 1/100 of a taka. All money is stored as an integer number of paisa.
- **Family**: the workspace (tenant). Every record belongs to exactly one family.

### 1.4 References
- BRD v0.1 (`docs/BRD.md`)
- Personal Data Protection Ordinance 2025 (Bangladesh)
- Google Play policy on SMS and Call Log permissions
- Anthropic Claude API documentation

---

## 2. Overall description

### 2.1 Product perspective

```
┌──────────────┐   ┌──────────────┐
│  apps/mobile │   │   apps/web   │      clients (Bangla/English UI)
│  Expo / RN   │   │   Next.js    │
└──────┬───────┘   └──────┬───────┘
       │  HTTPS + JSON (JWT)  │
       └──────────┬───────────┘
           ┌──────▼──────┐        ┌──────────────────┐
           │  apps/api   │───────▶│  Claude API      │  text / vision / Q&A
           │  Fastify    │        └──────────────────┘
           │  + Drizzle  │        ┌──────────────────┐
           │             │───────▶│ SMS/OTP gateway  │  (login)
           └──────┬──────┘        └──────────────────┘
                  │
           ┌──────▼──────┐
           │ PostgreSQL  │
           └─────────────┘

Shared packages: @amar-poribar/shared (schemas, categories, money/i18n)
                 @amar-poribar/ai     (MFS SMS parser, Claude-based parser)
```

The AI key is held **only by the API**. Clients never call the AI provider directly.

### 2.2 User classes

| Role | Permissions |
|---|---|
| **Owner** | Everything, including deleting the family and managing billing |
| **Admin** | Manage members, budgets, categories and accounts; edit all transactions |
| **Member** | Add transactions; edit their own; view family transactions (except others' private ones) |
| **Viewer** | Read-only dashboard and summaries (for example an expatriate earner) |

### 2.3 Operating environment
- Android 8.0+ (API 26+), 2 GB+ RAM. The release APK should stay under 30 MB.
- Recent browsers: Chrome, Edge, Safari, Firefox (last 2 versions), at 360 px width and up.
- Server: Node.js 22 LTS, PostgreSQL 16+, Linux containers.

### 2.4 Design and implementation constraints
- TypeScript everywhere. pnpm workspaces and Turborepo.
- Money is stored as an integer number of paisa (`bigint`/`integer`), never as a float.
- All timestamps are stored in UTC and displayed in `Asia/Dhaka`.
- No `READ_SMS` permission (Google Play policy). SMS comes in through paste or the Android share sheet.
- Every AI-generated record needs explicit user confirmation before it is saved as final.

### 2.5 Assumptions
See BRD §10.

---

## 3. Functional requirements

Priority: **M** = must, **S** = should, **C** = could.

### 3.1 Authentication and accounts (FR-AUTH)

| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-AUTH-01 | Users sign up or log in with a Bangladeshi mobile number (+8801XXXXXXXXX) and an OTP | M | P1 |
| FR-AUTH-02 | The system validates BD numbers: `^(?:\+?88)?01[3-9]\d{8}$` | M | P1 |
| FR-AUTH-03 | Sessions use a short-lived access JWT (15 min) and a rotating refresh token (30 days) | M | P1 |
| FR-AUTH-04 | Users can set a display name, preferred language (bn/en) and numeral style (Bangla/Latin) | M | P1 |
| FR-AUTH-05 | Users can delete their account and personal data (PDPO right to erasure) | M | P1 |
| FR-AUTH-06 | Optional email or Google sign-in for expatriate users | C | P3 |

### 3.2 Family workspace (FR-FAM)

| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-FAM-01 | A user can create a family (name, base currency BDT) and becomes its Owner | M | P1 |
| FR-FAM-02 | Owner/Admin can invite by phone number or a shareable link valid for 7 days | M | P1 |
| FR-FAM-03 | Owner/Admin can change roles and remove members | M | P1 |
| FR-FAM-04 | A user can belong to more than one family (for example own household and parents' household) and switch between them | S | P2 |
| FR-FAM-05 | Viewer role for expatriate members, with a summary-only view | S | P2 |

### 3.3 Wallets / accounts (FR-ACC)

| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-ACC-01 | The family can define accounts with a type: `cash`, `bkash`, `nagad`, `rocket`, `upay`, `bank`, `card`, `other` | M | P1 |
| FR-ACC-02 | An account can have an owner member (for example "Ammu's bKash") or be shared | M | P1 |
| FR-ACC-03 | Each account has an optional opening balance; the running balance = opening + income − expense ± transfers | S | P2 |

### 3.4 Transactions (FR-TXN)

| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-TXN-01 | Create a transaction with: type (`expense`/`income`/`transfer`), amount (paisa), date-time, category, account, paid-by member, note, optional counterparty, optional MFS TrxID, optional fee | M | P1 |
| FR-TXN-02 | List transactions filtered by month, category, member and account, with pagination (cursor, 50 per page) | M | P1 |
| FR-TXN-03 | Edit and delete transactions as allowed by role (§2.2). Deletes are soft deletes (kept 30 days) | M | P1 |
| FR-TXN-04 | Reject a duplicate MFS transaction with the same `trxId` within the family | M | P1 |
| FR-TXN-05 | Mark a transaction private, so it is visible only to its creator and counted only in anonymised totals | S | P2 |
| FR-TXN-06 | Recurring templates (monthly rent, help's salary, subscriptions) that create drafts on schedule | S | P2 |
| FR-TXN-07 | Attach a receipt image (≤ 5 MB, JPEG/PNG/WebP) | S | P2 |
| FR-TXN-08 | Split one bazaar receipt across several categories | C | P3 |

### 3.5 Categories (FR-CAT)

| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-CAT-01 | Seed default categories with Bangla and English names: Bazaar & Groceries, Rent, Utilities (Electricity/Gas/Water/Internet), Mobile Recharge, Transport, Education, Medical, Domestic Help, Clothing, Eating Out, Family Support (sent to relatives), Zakat/Charity/Sadaqah, Festival (Eid/Puja), Gifts & Dawat, Household Items, Personal Care, Entertainment, Loan/EMI, Fees & Charges, Other | M | P1 |
| FR-CAT-02 | Families can add, rename, hide and choose an icon for categories | M | P1 |
| FR-CAT-03 | Income categories: Salary, Business, Remittance Received, Rent Received, Other | M | P1 |

### 3.6 AI-assisted entry (FR-AI)

| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-AI-01 | **Free-text parse.** Given text in Bangla, Banglish or English (for example *"আজ বাজারে ৮৫০ টাকা, ক্যাশ"*, *"bazar 850 cash"*, *"Paid DESCO bill 2,340 via bKash"*), return one or more **drafts** with amount, type, category, account type, date, note and per-field confidence | M | P1 |
| FR-AI-02 | **MFS SMS parse.** Given pasted SMS text, run a **deterministic parser first** for bKash, Nagad and Rocket templates (send money, payment, cash out, bill pay, mobile recharge, received money) and extract amount, fee, counterparty, TrxID, balance and time. Fall back to the LLM only when no template matches | M | P1 |
| FR-AI-03 | Bangla digits (০-৯) and Latin digits, commas and lakh formatting (1,00,000) are normalised before parsing | M | P1 |
| FR-AI-04 | Relative dates ("আজ", "gotokal", "last Friday") resolve against the user's current date in Asia/Dhaka | M | P1 |
| FR-AI-05 | The AI never writes final records. It returns drafts that the user confirms or edits in one step | M | P1 |
| FR-AI-06 | The family's category list (IDs and names) is passed to the AI so it can only choose valid categories | M | P1 |
| FR-AI-07 | **Category learning.** User corrections ("Shwapno" → Bazaar) are stored as per-family merchant rules and applied before the AI | S | P2 |
| FR-AI-08 | **Voice entry.** Bangla speech → text (STT) → FR-AI-01 | S | P2 |
| FR-AI-09 | **Receipt/memo photo.** Image → vision model → drafts (supports printed receipts and handwritten Bangla *memos*) | S | P2 |
| FR-AI-10 | **Ask.** Natural-language questions over family data. The model calls server-side read-only tools (`sum_by_category`, `list_transactions`, `compare_months`) scoped to the user's family and permissions. Answers are given in the question's language | S | P2 |
| FR-AI-11 | **Monthly insight.** At the start of each month, generate a short Bangla/English summary: top categories, biggest change from last month, budget performance | C | P3 |
| FR-AI-12 | Per-family monthly AI quota, enforced by plan (BRD §8). When the quota is exhausted, users fall back to manual entry | M | P1 |

### 3.7 Budgets and alerts (FR-BUD)

| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-BUD-01 | Set a monthly budget per category and/or an overall family budget | M | P1 |
| FR-BUD-02 | Notify Owner/Admins (and optionally all members) at 80% and 100% of a budget | M | P1 |
| FR-BUD-03 | Copy last month's budgets forward automatically unless changed | S | P1 |
| FR-BUD-04 | Festival budget: a one-off budget with a date range (for example an Eid-ul-Adha budget) | S | P2 |

### 3.8 Reports and dashboard (FR-REP)

| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-REP-01 | Month summary: total income, total expense, net, and comparison with last month | M | P1 |
| FR-REP-02 | Breakdown by category, member and account | M | P1 |
| FR-REP-03 | 6- and 12-month trend per category | S | P2 |
| FR-REP-04 | Export a month or a range to CSV (P1), Excel and PDF (P3) | S | P1/P3 |

### 3.9 Notifications (FR-NOT)

| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-NOT-01 | Push notifications (FCM) for budget alerts and invitations | M | P1 |
| FR-NOT-02 | A daily reminder to log at a user-chosen time (default 21:00 Asia/Dhaka) | S | P1 |
| FR-NOT-03 | Bill-due reminders from recurring templates | S | P2 |

### 3.10 Offline and sync (FR-SYNC)

| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-SYNC-01 | The mobile app can capture manual transactions offline in a local store and sync when online | S | P2 |
| FR-SYNC-02 | Records use client-generated UUIDs; the server treats create as idempotent. Last-write-wins, using `updatedAt` per record | S | P2 |
| FR-SYNC-03 | AI parsing of text captured offline is queued and run once the device is online | S | P2 |

---

## 4. External interface requirements

### 4.1 User interface
- Bangla is the default language and English is available. All strings live in the shared i18n catalogue.
- Amounts are shown as `৳ 1,25,000` (lakh grouping) and in Bangla numerals as `৳ ১,২৫,০০০`.
- **Quick-add bar** on the home screen: a single text field with a mic button (P2), camera (P2) and paste-SMS. Pressing enter shows draft cards; confirming takes one tap.
- Touch targets ≥ 48 dp. WCAG 2.1 AA colour contrast. Light and dark themes.

### 4.2 API (REST, JSON, `/v1`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/auth/otp/request` | Send an OTP to a phone number |
| POST | `/v1/auth/otp/verify` | Verify the OTP and return tokens |
| POST | `/v1/auth/refresh` | Rotate the refresh token |
| GET | `/v1/me` | Profile and families |
| POST | `/v1/families` | Create a family |
| POST | `/v1/families/:id/invites` | Invite a member |
| GET/POST/PATCH | `/v1/families/:id/accounts` | Manage accounts |
| GET/POST/PATCH | `/v1/families/:id/categories` | Manage categories |
| GET/POST | `/v1/families/:id/transactions` | List and create |
| PATCH/DELETE | `/v1/families/:id/transactions/:txnId` | Update and delete |
| POST | `/v1/families/:id/ai/parse` | Text or SMS → drafts |
| POST | `/v1/families/:id/ai/receipt` | Image → drafts (P2) |
| POST | `/v1/families/:id/ai/ask` | Question → answer (P2) |
| GET/PUT | `/v1/families/:id/budgets?month=YYYY-MM` | Budgets |
| GET | `/v1/families/:id/reports/summary?month=YYYY-MM` | Dashboard data |
| GET | `/health` | Liveness check |

Request and response bodies are validated with the Zod schemas in `@amar-poribar/shared`. Errors use the format `{ error: { code, message } }` (RFC 7807-inspired).

### 4.3 Software interfaces
- **Claude API** (`@anthropic-ai/sdk`): structured outputs for parsing (JSON schema), vision for receipts, tool use for Ask. The model ID is configurable through `AI_MODEL`.
- **PostgreSQL** through Drizzle ORM.
- **FCM** for push notifications, and a **BD SMS gateway** for OTP.

---

## 5. Data requirements

### 5.1 Core entities

| Entity | Key fields |
|---|---|
| `users` | id (uuid), phone (unique), name, locale (`bn`/`en`), numeral_style, created_at |
| `families` | id, name, currency (`BDT`), plan, ai_quota_month, created_by |
| `family_members` | family_id, user_id, role (`owner`/`admin`/`member`/`viewer`), joined_at |
| `accounts` | id, family_id, name, type, owner_member_id?, opening_balance_paisa |
| `categories` | id, family_id, kind (`expense`/`income`), name_bn, name_en, icon, is_hidden |
| `transactions` | id, family_id, type, amount_paisa, fee_paisa, occurred_at, category_id, account_id, paid_by_user_id, note, counterparty, trx_id, source (`manual`/`ai_text`/`sms`/`voice`/`receipt`), ai_confidence, is_private, created_by, updated_at, deleted_at |
| `budgets` | id, family_id, category_id? (null = overall), month (`YYYY-MM`), limit_paisa |
| `merchant_rules` (P2) | family_id, pattern, category_id |
| `ai_usage` | family_id, month, requests, input_tokens, output_tokens |

Indexes: `transactions(family_id, occurred_at desc)`, and a unique `(family_id, trx_id)` where `trx_id` is not null.

### 5.2 Data retention
- Soft-deleted transactions are purged after 30 days.
- Raw SMS and receipt text is **not stored** after parsing unless the user attaches it.
- AI request logs keep only token counts and latency, no content.

---

## 6. AI subsystem design

### 6.1 Parse pipeline (FR-AI-01, -02)

```
input ──► normalise (Bangla digits, commas, whitespace)
      ──► is it an MFS SMS? ──yes──► template parser ──match──► draft (confidence 0.99)
      │                                   └─no match─┐
      ├──► merchant rules (P2) ──────────────────────┤
      └──► LLM structured parse (family categories in prompt) ──► validate with Zod ──► drafts
```

- **Structured output.** The model must return JSON that matches `ParsedDraftsSchema`. Invalid output gets one retry and then fails gracefully ("couldn't understand, please enter manually").
- **Amounts.** The model returns taka as a number; the server converts to paisa and rejects values ≤ 0 or above ৳1 crore per transaction.
- **Privacy.** Before sending, strip phone numbers to their last 3 digits and never send account numbers.
- **Cost.** Keep the system prompt and category list stable so prompt caching works. Use a low effort setting for parsing.
- **Safety.** If the model refuses or the response is truncated, return a non-fatal `ai_unavailable` error so the client falls back to manual entry.

### 6.2 Ask (FR-AI-10, P2)
- A tool-use loop with server-defined read-only tools whose SQL is always scoped by `family_id` and the caller's visibility (private transactions are excluded).
- At most 5 tool calls per question. Answers cite the figures they used.

---

## 7. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Performance | p95 API latency ≤ 300 ms for CRUD; ≤ 4 s for AI text parse; ≤ 8 s for receipt parse |
| NFR-02 | Performance | Mobile cold start ≤ 3 s on a mid-range Android device (for example a Redmi or Samsung A-series phone) |
| NFR-03 | Data usage | A typical session uses ≤ 200 KB, excluding images. Images are compressed to ≤ 300 KB before upload |
| NFR-04 | Availability | 99.5% monthly for the API |
| NFR-05 | Security | TLS 1.2+; OWASP ASVS L2; Argon2/bcrypt for any secret; OTP rate limiting (5 per hour per number); per-user API rate limits |
| NFR-06 | Security | Tenant isolation: every query is scoped by `family_id`, with an automated test per endpoint |
| NFR-07 | Privacy | PDPO 2025: explicit consent at sign-up, data export and deletion within 30 days, a processing record, breach notification process, disclosure of cross-border AI processing |
| NFR-08 | Reliability | Daily database backups kept 14 days; restore tested quarterly |
| NFR-09 | Localisation | 100% UI string coverage in bn and en; Bangla fonts (Noto Sans Bengali / Hind Siliguri) bundled |
| NFR-10 | Accessibility | WCAG 2.1 AA; screen-reader labels on all actions |
| NFR-11 | Maintainability | TypeScript strict mode; shared schemas; ≥ 70% unit-test coverage for `packages/*`; CI runs lint, typecheck and tests |
| NFR-12 | Observability | Structured JSON logs (pino) without PII; error tracking; AI usage metrics per family |
| NFR-13 | Cost | AI cost ≤ ৳15 per active family per month (BO-6) |

---

## 8. Monorepo structure

```
amar-poribar/
├── apps/
│   ├── api/        Fastify REST API + Drizzle (PostgreSQL)
│   ├── web/        Next.js web app
│   └── mobile/     Expo (React Native) Android/iOS app
├── packages/
│   ├── shared/     Zod schemas, types, categories, money + Bangla formatting, i18n
│   ├── ai/         MFS SMS parser + Claude-based expense parser
│   └── tsconfig/   Shared TypeScript configs
├── docs/           BRD, SRS
├── docker-compose.yml   Local PostgreSQL
├── turbo.json, pnpm-workspace.yaml, package.json
```

---

## 9. Traceability (BRD → SRS)

| BR | Covered by |
|---|---|
| BR-01, BR-02 | FR-AUTH-01..05, FR-FAM-01..03 |
| BR-03 | FR-AI-01, -03..06 |
| BR-04 | FR-AI-02, FR-TXN-04 |
| BR-05 | FR-ACC-01..03 |
| BR-06 | FR-CAT-01..03 |
| BR-07 | FR-BUD-01..03, FR-NOT-01 |
| BR-08 | FR-REP-01..02 |
| BR-09 | §4.1, NFR-09 |
| BR-10 | FR-AI-08 |
| BR-11 | FR-AI-09, FR-TXN-07 |
| BR-12 | FR-AI-10 |
| BR-13 | FR-FAM-05 |
| BR-14 | FR-SYNC-01..03 |
| BR-15 | FR-TXN-06, FR-NOT-03 |
| BR-16 | FR-TXN-05 |
| BR-17 | (P3, payment gateway, to be specified) |
| BR-18 | (P3, to be specified) |
| BR-19 | FR-REP-04, FR-AI-11 |
| BR-20 | FR-AUTH-05, §5.2, NFR-07 |

---

## 10. MVP acceptance criteria

1. Two family members on different phones each log an expense, and both see the same month total within 5 seconds of refresh.
2. *"আজ বাজারে ৮৫০ টাকা দিলাম ক্যাশে"* produces a draft: expense, ৳850, Bazaar & Groceries, account type cash, today.
3. A real bKash "Send Money" SMS produces amount, fee, recipient (masked), TrxID and time **without any AI call**.
4. Pasting the same SMS twice does not create a duplicate (FR-TXN-04).
5. A Bazaar budget of ৳10,000 triggers an alert when spending passes ৳8,000.
6. All screens can be switched between Bangla and English, with no untranslated strings.
7. A Member cannot edit another member's transaction (returns 403), and no endpoint returns another family's data (returns 404).
