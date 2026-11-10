# Web and admin tasks (`T-WEB`, `T-ADMUI`)

Scope: the family web app (`apps/web`, 20 W-screens plus comms) and the new staff console (`apps/admin`). Follows [README](./README.md) (template, no human gates) and [SRS v1.0](../SRS.md). Visual spec: the design canvas https://claude.ai/artifact/4h5SPurNz7kAb1oJQdozwW (screen codes such as `A3`, `G2`). Task count: **T-WEB-01..41** and **T-ADMUI-01..14** (55 tasks).

## 0. Orientation

### 0.1 What exists today (commit `e2ef7bc`) and what happens to it
`apps/web` is Next 16.4 / React 19.3 with one client page `app/page.tsx` (675 lines, 11 inline components), `app/layout.tsx`, `app/globals.css`, `lib/api.ts` (`fetch` wrapper using `NEXT_PUBLIC_API_URL`) and `lib/voice.ts` (Web Speech wrappers). The access token is kept in `localStorage` (`amar-poribar.token`), there is no refresh, no routing, no tests, no admin app.

| Existing piece | New home | Fate |
|---|---|---|
| `Home` + `loadToken/saveToken` | `app/(app)/layout.tsx` + BFF cookies | **Replaced** (T-WEB-02, -03) |
| `Login` | `app/(auth)/login/page.tsx` + `components/features/auth/LoginForm.tsx` | Rewritten to A1/A7 (T-WEB-10) |
| `FamilyHome` (loading, invite via `?invite=`) | `(app)/layout.tsx`, `app/(auth)/join/[token]/page.tsx` | Split (T-WEB-02, -12) |
| `CreateFamily` | `app/(auth)/consent/page.tsx` | Rewritten to A2 (T-WEB-11) |
| `QuickAdd` | `components/features/entry/QuickAdd.tsx`, `DraftCard.tsx` | Kept, restyled (T-WEB-13, -14) |
| `Dashboard`, `Delta`, `shiftMonth`, `delta` | `components/features/reports/MonthSummaryCard.tsx`, `lib/format/month.ts` | Kept, logic moved (T-WEB-02, -26) |
| `ManageLists` | `app/(app)/accounts`, `categories` | Rewritten to E1/E2 (T-WEB-24) |
| `Members` | `app/(app)/family/page.tsx` | Rewritten to B4 (T-WEB-22) |
| `Budgets` | `app/(app)/budget/page.tsx` | Rewritten to B3 (T-WEB-21) |
| `SpokenSummary` | `app/(app)/summary/page.tsx` | Rewritten to B2 (T-WEB-20) |
| `CategoryPicker` | `components/features/entry/CategoryPicker.tsx` | Kept (A4) |
| `lib/voice.ts` | `lib/speech/recognition.ts`, `lib/speech/synthesis.ts` | Moved, extended (T-WEB-09) |
| `lib/api.ts` | `lib/api/client.ts` | **Deleted** after T-WEB-04 |
| `globals.css` | tokens in `styles/tokens.css`, base in `styles/base.css` | Replaced (T-WEB-06) |
| Strings from `packages/shared` `t()` | same package, plus `lib/i18n/` provider | Kept, extended (T-WEB-05) |

### 0.2 Target structure
```
apps/web/
├── app/
│   ├── layout.tsx                   root: fonts, <Providers>, manifest link
│   ├── manifest.ts                  PWA manifest
│   ├── (auth)/layout.tsx            centred, no tab bar
│   │   ├── welcome/page.tsx         D1
│   │   ├── login/page.tsx           A1 + A7
│   │   ├── consent/page.tsx         A2
│   │   ├── join/[token]/page.tsx    A6 + F6 (expired)
│   │   └── session-expired/page.tsx F6
│   ├── (app)/layout.tsx             auth guard, FamilyProvider, RealtimeProvider, TabBar
│   │   ├── page.tsx                 Home (Main)
│   │   ├── list/page.tsx            B1        ├── chat/page.tsx F1      ├── budget/page.tsx B3     ├── family/page.tsx B4
│   │   ├── chat/[conversationId]/page.tsx     ├── buzz/page.tsx 2       ├── voice-note/page.tsx 4  ├── call/[callId]/page.tsx 5
│   │   ├── add/page.tsx D4  add/voice/page.tsx A3  add/sms/page.tsx A5  add/receipt/page.tsx D6
│   │   ├── txn/[id]/page.tsx D5     ├── summary/page.tsx B2   ├── ask/page.tsx B5       ├── settings/page.tsx B6
│   │   ├── profile/page.tsx F8      ├── accounts/page.tsx E1  ├── categories/page.tsx E2 ├── recurring/page.tsx E3
│   │   ├── festival/new/page.tsx E4 ├── reports/page.tsx E5   ├── remit/page.tsx E6      ├── plans/page.tsx E7
│   │   ├── notifications/page.tsx F3├── bazaar/page.tsx F5    ├── switch-family/page.tsx F2
│   │   └── delete-account/page.tsx F7
│   └── api/
│       ├── auth/{otp/request,otp/verify,refresh,logout,session,ws-token}/route.ts   BFF (T-WEB-03)
│       └── proxy/[...path]/route.ts                                                 authenticated API proxy
├── components/{ui,shell,features/<area>}/
├── lib/{api,auth,i18n,speech,realtime,media,rtc,format,push,pwa}/
├── mocks/{handlers.ts,server.ts,fixtures.ts}        MSW (unit tests and AP_MOCK=1 server mode)
├── e2e/{playwright.config.ts,fixtures,flows,visual,helpers}
├── public/{icons/*,sw.js,firebase-messaging-sw.js}
└── styles/{tokens.css,base.css}
```

### 0.3 Cookies, env and ports (used by every task)
| Name | Where | Flags | Content |
|---|---|---|---|
| `ap_at` | BFF | httpOnly, Secure (not on localhost), SameSite=Lax, path `/`, Max-Age 900 | access JWT |
| `ap_rt` | BFF | httpOnly, Secure, SameSite=Lax, path `/api/auth`, Max-Age 30 d | refresh token |
| `ap_fid` | client | SameSite=Lax, path `/`, 1 y | active family id |
| `ap_loc`, `ap_num`, `ap_simple` | client | SameSite=Lax, 1 y | `bn`/`en`, `bn`/`latn`, `0`/`1` |

Env (server): `API_URL` (default `http://localhost:4000`), `COOKIE_SECURE` (`auto`), `AP_MOCK` (`1` starts MSW on the server). Env (public): `NEXT_PUBLIC_WS_URL` (default `ws://localhost:4000/v1/ws`), `NEXT_PUBLIC_FIREBASE_*` (six web-push keys), `NEXT_PUBLIC_VAPID_KEY`. Web runs on 3000, admin on 3100.

### 0.4 Dependency graph
```
T-WEB-01 tooling ─┬─ 02 split page ─ 03 auth BFF ─ 04 api client+msw ─┬─ 05 i18n ─ 06 theme/ui ─ 07 shell ─ 08 states+pwa ─ 09 speech
                  │                                                  │
                  │   screens (need 05–09):  10 login ─ 11 welcome/consent ─ 12 join/expired ─ 13 home
                  │                          14 voice entry ─ 15 sms ─ 16 manual add ─ 17 detail+rules ─ 18 receipt ─ 19 list
                  │                          20 summary+ask ─ 21 budgets ─ 22 family ─ 23 settings+profile ─ 24 accounts+cats ─ 25 recurring+festival
                  │                          26 reports+remit ─ 27 plans ─ 28 notifications ─ 29 bazaar ─ 30 delete account
                  │   realtime:              31 realtime client ─ 32 buzz ─ 33 chat ─ 34 media notes ─ 35 video call ─ 36 web push
                  └─ 37 playwright infra ─ 38 core flows ─ 39 comms flows ─ 40 visual ─ 41 CI (web + admin)
T-ADMUI-01 scaffold ─ 02 staff auth BFF ─ 03 sign-in/TOTP ─ 04 layout+ui ─ 05 overview ─ 06 families ─ 07 family detail ─ 08 privacy ─ 09 plans ─ 10 audit ─ 11 staff ─ 12 health ─ 13 sentinel test ─ 14 playwright admin
```

### 0.5 Parallelism and mocks
- After T-WEB-04, every screen task can start against **MSW handlers** (`mocks/handlers.ts`) generated from `apps/api/openapi.json`; no backend task has to land first. A screen task is "complete" when its Vitest and mock-mode Playwright tests pass; the real-stack flows (T-WEB-38/39) run once the backend tasks exist.
- Can run in parallel after T-WEB-09: 10–12; 13–19; 20–23; 24–30. Realtime 31–36 need only T-WEB-04 plus the WebSocket contract in SRS §5.4 (mock WebSocket server in `mocks/ws-server.ts`).
- Backend capabilities these tasks consume (by area): **T-ID** (rotating refresh, OTP error codes, `PATCH /v1/me`, consents, devices), **T-FAM** (invite preview, ownership transfer), **T-LED** (cursor list, restore, merchant rules, attachments), **T-BUD**, **T-REC**, **T-AI** (usage, quota error), **T-REP** (trend), **T-COMM**, **T-NOTIF** (inbox, preferences, devices), **T-SHOP**, **T-BILL**, **T-PRIV**, **T-ADM**. Each task below names the endpoint it needs, so it can be mocked.
- Cross-area note for **T-COMM**: browsers record voice as `audio/webm;codecs=opus` (Chrome, Firefox) or `audio/mp4` (Safari) and video as `video/webm`. The media endpoints must accept these MIME types in addition to AAC `.m4a` and H.264 `.mp4`, and the Flutter player must play WebM/Opus. If the API rejects with `unsupported_media`, the web UI shows the generic upload error (T-WEB-34).

### 0.6 Shared conventions
- **Package versions** (pin in `apps/web/package.json`): `next ^16.4.0`, `react ^19.3.0`, `@tanstack/react-query ^5.62.0`, `openapi-fetch ^0.13.0`, `react-hook-form ^7.54.0`, `@hookform/resolvers ^3.9.0`, `zod ^4.1.0` (same as API), `firebase ^11.1.0`; dev: `openapi-typescript ^7.4.0`, `vitest ^5.0.0` (same as API), `@vitest/coverage-v8 ^5.0.0`, `jsdom ^25.0.0`, `@testing-library/react ^16.1.0`, `@testing-library/user-event ^14.5.0`, `@testing-library/jest-dom ^6.6.0`, `msw ^2.6.0`, `@playwright/test ^1.49.0`, `@axe-core/playwright ^4.10.0`, `eslint ^9`, `eslint-config-next ^16`, `eslint-plugin-jsx-a11y ^6.10.0`.
- **Money** is integer paisa end to end; use `formatBDT`, `parseAmountToPaisa`, `amountToWords` from `packages/shared`. Never `Number` arithmetic on taka.
- **Components** are server components unless they use state, effects or browser APIs; those files start with `"use client"`.
- **Every interactive element** has a visible Bangla label or `aria-label`; icon-only buttons never carry meaning alone (icon + word rule). Touch targets ≥ 48 px, primary ≥ 56 px (Simple mode ≥ 72 px).
- **Tests** live next to the code (`*.test.tsx`) and in `e2e/`. Test names below are exact; use them so milestone scripts can grep for them.

---

## 1. T-WEB tasks

### T-WEB-01 · Tooling, lint and unit-test harness
- **Closes:** GAP-WEB-04, NFR-11
- **Depends on:** T-PLAT-01 (workspace scripts)  · **Milestone:** M0 · **Layer:** web
**Why** — Nothing in `apps/web` can be changed safely without tests and linting.
**Files**
- M `apps/web/package.json` (scripts `lint`, `test`, `test:watch`, `gen:api`, `gen:api:check`, `e2e`, `e2e:mock`; dev deps from §0.6)
- C `apps/web/vitest.config.ts`, `apps/web/vitest.setup.ts`, `apps/web/eslint.config.mjs`, `apps/web/.eslintignore`
- M `apps/web/tsconfig.json` (add `paths`: `@/*` → `./*`; `types: ["vitest/globals","@testing-library/jest-dom"]`)
- C `apps/web/mocks/server.ts` (empty `setupServer()` export for now)
**Steps**
1. `pnpm --filter @amar-poribar/web add @tanstack/react-query openapi-fetch react-hook-form @hookform/resolvers zod firebase` and the dev deps in §0.6.
2. `vitest.config.ts`: `environment: "jsdom"`, `setupFiles: ["./vitest.setup.ts"]`, `include: ["**/*.test.{ts,tsx}"]`, `exclude: ["e2e/**"]`, alias `@` → project root, coverage provider `v8` with thresholds `lines: 70, functions: 70` on `lib/**` and `components/**`.
3. `vitest.setup.ts`: import `@testing-library/jest-dom/vitest`; start MSW `server.listen({ onUnhandledRequest: "error" })` before all, `resetHandlers()` after each, `close()` after all; stub `matchMedia`, `IntersectionObserver`, `speechSynthesis` (records `speak()` calls to `globalThis.__spoken`), `navigator.vibrate` (records patterns to `globalThis.__vibrations`).
4. ESLint flat config: `next/core-web-vitals`, `next/typescript`, `jsx-a11y/recommended` with `jsx-a11y/no-static-element-interactions: error`, `no-restricted-imports` banning `@/lib/api/legacy` and `localStorage` in `app/**` and `components/**` (token storage rule, enforced after T-WEB-03).
5. Add scripts to root `turbo.json` so `pnpm test` and `pnpm lint` include web (already generic; confirm `lint` task exists in `apps/web`).
6. Add one smoke test `lib/format/month.test.ts` later moved in T-WEB-02; for now `smoke.test.ts` that renders `<div/>` to prove the harness.
**Contract** — none.
**Tests** — `smoke.test.ts › "renders with jsdom and jest-dom matchers"`.
**Acceptance** — `pnpm --filter @amar-poribar/web lint && pnpm --filter @amar-poribar/web test --run && pnpm --filter @amar-poribar/web typecheck`.
**Done when** — all three commands exit 0 and `vitest --coverage` prints a coverage table.

### T-WEB-02 · Split `page.tsx` into routes and components (no behaviour change)
- **Closes:** GAP-WEB-01
- **Depends on:** T-WEB-01  · **Milestone:** M2 · **Layer:** web
**Why** — A 675-line page blocks every other screen. This task only moves code so later tasks can replace pieces independently.
**Files**
- C `apps/web/components/features/auth/LoginForm.tsx` (old `Login`)
- C `apps/web/components/features/family/CreateFamilyForm.tsx`, `MemberList.tsx`
- C `apps/web/components/features/entry/QuickAdd.tsx`, `CategoryPicker.tsx`
- C `apps/web/components/features/reports/MonthSummaryCard.tsx` (old `Dashboard` + `Delta`), `apps/web/lib/format/month.ts` (`shiftMonth`, `delta`)
- C `apps/web/components/features/budget/BudgetList.tsx`, `apps/web/components/features/ledger/ManageLists.tsx`, `apps/web/components/features/reports/SpokenSummary.tsx`
- C `apps/web/lib/types.ts` (the local `Family`, `Member`, `Category`, `Account`, `BudgetRow`, `RoleName` types; later replaced by generated types in T-WEB-04)
- M `apps/web/app/page.tsx` (thin composition of the moved components, still using `localStorage` until T-WEB-03)
- M `apps/web/lib/voice.ts` unchanged
**Steps**
1. Cut each inline component into its file keeping props identical; export as named functions; keep `"use client"` at the top of every file that uses hooks.
2. Move `shiftMonth` and `delta` into `lib/format/month.ts`; export `monthLabel(month, locale)` replacing the inline `toLocaleDateString` call.
3. `app/page.tsx` imports the components and keeps the original `FamilyHome` orchestration as `components/features/family/FamilyHome.tsx`.
4. Write characterization tests before moving (they fail if behaviour changes): render each component with MSW handlers returning the same payload shapes the API returns today.
**Contract** — none (pure refactor).
**Tests** — `lib/format/month.test.ts › "shiftMonth crosses year boundaries"`, `› "delta returns null when previous is 0"`; `MonthSummaryCard.test.tsx › "shows more/less with bad/good colour class"`; `QuickAdd.test.tsx › "voice transcript is parsed and read back"` (fake SpeechRecognition + `__spoken`); `BudgetList.test.tsx › "exceeded level shows the budgetExceeded word"`; `MemberList.test.tsx › "only owner can change admin role"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run && pnpm --filter @amar-poribar/web build`; `wc -l apps/web/app/page.tsx` ≤ 40.
**Done when** — the site behaves exactly as before and no component file exceeds 250 lines.

### T-WEB-03 · Auth BFF: httpOnly cookies, refresh, API proxy
- **Closes:** GAP-WEB-02, FR-AUTH-03, FR-AUTH-09, NFR-05
- **Depends on:** T-WEB-02; backend T-ID (rotating refresh tokens; until then the BFF treats `refreshToken` as reusable)  · **Milestone:** M1 · **Layer:** web
**Why** — Tokens in `localStorage` are readable by any injected script. Cookies set by the server cannot be read by JavaScript and survive reloads.
**Files**
- C `apps/web/lib/auth/cookies.ts`, `refresh.ts`, `csrf.ts`, `session.ts`
- C `apps/web/app/api/auth/otp/request/route.ts`, `otp/verify/route.ts`, `refresh/route.ts`, `logout/route.ts`, `session/route.ts`, `ws-token/route.ts`
- C `apps/web/app/api/proxy/[...path]/route.ts`
- C `apps/web/middleware.ts` (redirect unauthenticated to `/login?next=`)
- M `apps/web/components/features/auth/LoginForm.tsx`, `apps/web/app/page.tsx` (use cookies; remove `loadToken/saveToken`)
- D `apps/web/lib/api.ts` after T-WEB-04 replaces it
**Steps**
1. `cookies.ts`: `setSession(res, {accessToken, refreshToken})` writes `ap_at` (Max-Age 900) and `ap_rt` (30 d, `path=/api/auth`); `clearSession(res)`; flags from `COOKIE_SECURE` (`auto` = Secure when `request.url` is https).
2. `otp/request` and `otp/verify` handlers call `${API_URL}/v1/auth/otp/{request,verify}` with the JSON body, forward `Accept-Language`, and on verify success call `setSession`. Pass through error bodies `{error:{code,message,details}}` and status unchanged (A7 needs `attemptsLeft`, `retryAfterSeconds`). Never return tokens in the response body; return `{ ok: true, user, families }`.
3. `refresh.ts`: `refreshSession(refreshToken)` posts to `/v1/auth/refresh`, **single-flight** per refresh token (module-level `Map<string, Promise<Tokens>>` keyed by SHA-256 of the token, entry removed 10 s after settle) so two parallel requests do not trigger reuse detection.
4. Proxy handler for `GET|POST|PUT|PATCH|DELETE`: read `ap_at`; forward to `${API_URL}/${path}${search}` with `Authorization: Bearer`, `Content-Type`, `Idempotency-Key`, `Accept-Language`, body streamed; on upstream 401 → `refreshSession(ap_rt)` → retry once with the new token and set cookies on the response; if refresh fails → clear cookies and return `401 {error:{code:"session_expired"}}`. Response headers: drop hop-by-hop, keep `content-type`, `content-disposition` (CSV), `cache-control: no-store`. Allow list: path must start with `v1/`; anything else → 404.
5. `csrf.ts`: for non-GET/HEAD requests require header `x-ap-csrf: 1` and `Origin` equal to the request host (or absent for same-origin server fetch); otherwise `403 {error:{code:"csrf"}}`.
6. `session/route.ts` returns `{ authenticated, userId }` by decoding (not verifying) `ap_at` expiry; `ws-token/route.ts` returns `{ token }` = a fresh access token (refreshing first if within 60 s of expiry) for the WebSocket auth frame (SRS §5.4); response `cache-control: no-store`.
7. `middleware.ts`: matcher excludes `/api`, `/_next`, `/welcome`, `/login`, `/join`, `/session-expired`, `/manifest.webmanifest`, `/sw.js`, icons; redirect to `/login?next=<path>` when neither `ap_at` nor `ap_rt` exists.
8. Update `LoginForm` to `fetch("/api/auth/otp/request", {method:"POST", headers:{"x-ap-csrf":"1"}})`.
**Contract** — BFF routes above; proxy preserves API contract. Error codes: `session_expired`, `csrf`, `not_found`.
**Tests** — `lib/auth/refresh.test.ts › "parallel callers share one refresh call"`, `› "failed refresh clears cookies"`; `app/api/proxy/route.test.ts` (Vitest with `NextRequest`, MSW upstream) `› "adds Bearer from cookie"`, `› "retries once after 401 with rotated cookies"`, `› "rejects POST without x-ap-csrf"`, `› "rejects non-v1 paths"`; `app/api/auth/otp/verify/route.test.ts › "sets httpOnly cookies and never returns tokens"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run app/api lib/auth`; `grep -R "localStorage" apps/web/app apps/web/components apps/web/lib | wc -l` prints `0`.
**Done when** — login works end to end in the browser with no token visible to JavaScript (`document.cookie` shows neither `ap_at` nor `ap_rt`).

### T-WEB-04 · Typed API client, React Query, MSW handlers
- **Closes:** GAP-ARCH-07 (web side), NFR-01
- **Depends on:** T-WEB-03; T-PLAT (generates `apps/api/openapi.json`; until it exists, commit a hand-made stub `apps/web/mocks/openapi.stub.json` with the routes used so far)  · **Milestone:** M2 · **Layer:** web
**Why** — One generated client means the web cannot drift from the API (DEC-17) and screens can be built against mocks.
**Files**
- C `apps/web/lib/api/schema.d.ts` (generated, committed), `client.ts`, `errors.ts`, `queryKeys.ts`, `hooks/useMe.ts`, `useFamilyData.ts`
- C `apps/web/components/Providers.tsx` (QueryClientProvider + later providers), M `apps/web/app/layout.tsx`
- C `apps/web/mocks/handlers.ts`, `fixtures.ts`, `server.ts`, `instrumentation.ts` (root, starts MSW node server when `AP_MOCK=1`)
- M `apps/web/package.json` (`gen:api`: `openapi-typescript ../api/openapi.json -o lib/api/schema.d.ts`; `gen:api:check`: regenerate to a temp file and `diff`)
**Steps**
1. `client.ts`: `createClient<paths>({ baseUrl: "/api/proxy/" })` with middleware that adds `x-ap-csrf: 1`, `Accept-Language` from `ap_loc`, and for POST creates an `Idempotency-Key` UUID when the call passes `idempotent: true`.
2. `errors.ts`: `class ApiProblem extends Error {status, code, message, details}`; `toProblem(response)`; `isSessionExpired(p)` → triggers `router.replace("/session-expired?next=…")` through a global `onSessionExpired` registry used by the QueryClient `QueryCache.onError`.
3. `queryKeys.ts`: factory `qk.me()`, `qk.family(id).summary(month)`, `.transactions(filters)`, `.budgets(month)`, `.accounts()`, `.categories()`, `.members()`, `.conversations()`, `.messages(cid)`, `.inbox()`, `.presence()`, `.shopping(id)`.
4. QueryClient defaults: `staleTime 15_000`, `retry` 1 for network errors only (never for 4xx), `refetchOnWindowFocus: true`.
5. `mocks/fixtures.ts`: `demoFamily()` (রহিম পরিবার, 5 members with the design's names, 120 transactions, budgets, accounts, categories) built with deterministic ids; `mocks/handlers.ts`: one handler per route used by a screen, returning fixtures; helper `overrideOnce(path, response)` for tests.
6. `instrumentation.ts`: `if (process.env.AP_MOCK === "1") { const { server } = await import("./mocks/server"); server.listen({ onUnhandledRequest: "warn" }); }`.
7. Delete `lib/api.ts` and update the remaining imports.
**Contract** — generated `paths` types; `ApiProblem.code` values are exactly the API error codes in SRS §5.2.
**Tests** — `lib/api/client.test.ts › "sends csrf header and language"`, `› "maps error body to ApiProblem"`; `lib/api/errors.test.ts › "session_expired triggers redirect once"`.
**Acceptance** — `pnpm --filter @amar-poribar/web gen:api:check && pnpm --filter @amar-poribar/web test --run && AP_MOCK=1 pnpm --filter @amar-poribar/web build`.
**Done when** — no file imports `fetch` directly except `lib/api/client.ts`, `lib/auth`, `lib/media/upload.ts` (grep check in a test `architecture.test.ts › "only api client calls fetch"`).

### T-WEB-05 · i18n, numerals and Simple-mode preferences
- **Closes:** FR-I18N-01, FR-AUTH-04, FR-VOICE-09 (web part), NFR-09, AC-06
- **Depends on:** T-WEB-04  · **Milestone:** M2 · **Layer:** web
**Why** — Every screen must switch between Bangla and English, show digits per the user's setting, and offer a larger-text mode.
**Files**
- C `apps/web/lib/i18n/{provider.tsx,useT.ts,format.ts,web-strings.ts,cookie.ts}`
- M `packages/shared/src/i18n.ts` (keys used by both API and web), C `apps/web/lib/i18n/keys.test.ts`
- C `apps/web/components/shell/PreferenceBridge.tsx`
**Steps**
1. `I18nProvider` reads `ap_loc`, `ap_num`, `ap_simple` on the server (`cookies()`) and passes initial values to the client provider so first paint has no flash.
2. `useT()` returns `t(key, vars?)`: looks up `web-strings.ts` first, then `packages/shared` `t`. Supports `{name}` interpolation. Missing key in dev throws; in production returns the key and logs once.
3. `format.ts`: `useFormat()` → `money(paisa)`, `num(n)`, `date(iso, style)`, `relative(iso)` ("৫ মিনিট আগে"), using `formatBDT(..., {bnDigits})` and `Intl.DateTimeFormat("bn-BD", {timeZone:"Asia/Dhaka"})`. Respect `ap_num`.
4. `setPreference(partial)` updates cookie, context, and, when signed in, `PATCH /v1/me` (`{locale, bnDigits, simpleMode}`) through `PreferenceBridge` (debounced 500 ms).
5. Simple mode: `<html data-simple="1">` sets CSS variables `--text-scale: 1.3`, `--primary-height: 72px` (consumed in T-WEB-06).
6. Move every hard-coded Bangla literal out of components into `web-strings.ts` (bn + en). Strings quoted in the tasks below are the bn values.
**Contract** — `PATCH /v1/me` body `{ name?, locale?, bnDigits?, simpleMode?, reminderTime? }`.
**Tests** — `lib/i18n/keys.test.ts › "bn and en have identical key sets"`, `› "no unused keys (grep components)"`, `› "no Bangla literals in components"` (regex over `components/**/*.tsx`, allow list for `aria-label` fixtures); `format.test.ts › "money uses lakh grouping and Bangla digits"`, `› "latin numerals when ap_num=latn"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run lib/i18n`.
**Done when** — AC-06 key-diff test passes and toggling language in a Vitest render changes every label under the provider.

### T-WEB-06 · Design tokens, dark theme and UI kit
- **Closes:** FR-A11Y-01..03, NFR-10, SRS §5.1.1
- **Depends on:** T-WEB-05  · **Milestone:** M2 · **Layer:** web
**Why** — All screens share one set of sizes, colours and components taken from the design.
**Files**
- C `apps/web/styles/tokens.css`, `base.css`; M `apps/web/app/layout.tsx`; D `apps/web/app/globals.css`
- C `apps/web/components/ui/{Button,IconButton,BigAction,Card,Chip,SegmentedControl,Toggle,Field,OtpBoxes,AmountInput,Banner,Dialog,Sheet,ProgressBar,StatusPill,Avatar,Spinner,EmptyState}.tsx` each with a `.test.tsx`
- C `apps/web/components/ui/icons.tsx` (inline SVG set: mic, buzz, chat, video, home, list, budget, family, gear, play, speaker, check, close, back, camera, receipt, lock, warning, info)
- C `packages/shared/src/design-tokens.ts` (token source) and `apps/web/styles/tokens.test.ts`
**Steps**
1. Tokens (light): `--bg #FFF8EE`, `--ink #2A2118`, `--muted #5A4B3B`, `--green-700 #1B5E20`, `--green-100 #E6F2E3`, `--amber #F2A33A`, `--danger #B3261E`, `--border #E8DCC8`, `--card #FFFFFF`, radii `--r-card 22px`, `--r-pill 999px`. Dark values from `design-tokens.ts` mapping (bg `#151614`, card `#1F201D`, ink `#ECEBE6`, muted `#B7B6AE`, green-700 `#4CAF50`, green-100 `#1E3A21`, amber `#F2A33A`, danger `#F2827A`, border `#33342F`), applied under `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`.
2. Font: self-host Hind Siliguri 400/500/600/700 via `next/font/local` (files in `public/fonts`), replacing the Google Fonts `@import`.
3. Components: `Button` variants `primary` (green), `secondary` (outline), `buzz` (amber), `danger`; sizes `md` 48px, `lg` 56px, `xl` 72px; `BigAction` = icon over word, min-height 84px, used for Home tiles; `StatusPill` always renders icon + word + colour; `OtpBoxes` six inputs with paste support and `inputMode="numeric"`, `autocomplete="one-time-code"`; `AmountInput` shows digits and the Bangla words line beneath using `amountToWords`.
4. Every component accepts `lang`-aware label props, uses real `<button>`/`<input>`, visible focus ring (3 px `--green-700` offset 2 px).
5. `Dialog` uses `<dialog>` with focus trap, `Escape` closes unless `blocking`.
6. `tokens.test.ts` loads token pairs (ink/bg, muted/bg, white/green-700, ink/amber, danger/white, and dark equivalents) and asserts WCAG contrast ≥ 4.5:1 with a small luminance helper.
**Contract** — CSS variables above; component prop types exported.
**Tests** — `Button.test.tsx › "xl size has min-height 72px in simple mode"`, `› "disabled has aria-disabled"`; `StatusPill.test.tsx › "renders icon, word and class for each level"`; `OtpBoxes.test.tsx › "pasting 6 digits fills all boxes"`, `› "backspace moves focus back"`; `AmountInput.test.tsx › "shows ৳ ৮৫০ and আটশো পঞ্চাশ টাকা"`; `tokens.test.ts › "all pairs meet 4.5:1"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/ui styles`.
**Done when** — no raw hex colours remain in `app/` or `components/features/` (`grep -R "#[0-9A-Fa-f]\{6\}" apps/web/app apps/web/components/features` prints nothing).

### T-WEB-07 · App shell: tab bar, headers, family context, guards
- **Closes:** FR-NAV-01, FR-FAM-04 (context), GAP-WEB-01
- **Depends on:** T-WEB-06  · **Milestone:** M2 · **Layer:** web
**Why** — One navigation on every tab screen (design rule): হোম · কথা · তালিকা · বাজেট · পরিবার, with the gear on Home and the family tab.
**Files**
- C `apps/web/app/(app)/layout.tsx`, `apps/web/components/shell/{TabBar.tsx,PageHeader.tsx,BackHeader.tsx,FamilyProvider.tsx,useFamily.ts,RoleGate.tsx}`
- C `apps/web/lib/hooks/useUnreadCount.ts`
**Steps**
1. `(app)/layout.tsx` (server component) checks the session cookie, then renders `<FamilyProvider>` and `<TabBar>`; tab routes: `/`, `/chat`, `/list`, `/budget`, `/family`. The bar is hidden on pushed screens (decided by a `showTabs` flag exported from each route's `layout` segment config via a `useSelectedLayoutSegment` map).
2. `TabBar`: 5 items, icon 26 px + 12 px label, height 72 px, active = green 700 + bold; `কথা` shows a red count badge with `aria-label="২টি নতুন"` using `useUnreadCount()` (sum of unread from `GET /v1/families/:id/conversations`).
3. `FamilyProvider`: loads `GET /v1/me`; active family = `ap_fid` cookie if still a member else first; exposes `{family, families, role, switchFamily(id), me}`; if no family → redirect `/consent`.
4. `RoleGate role="member"`: renders children when role rank ≥ given; otherwise `EmptyState` "আপনি শুধু দেখতে পারবেন।" (viewer).
5. `BackHeader` renders a 56 px back button (`aria-label="পেছনে"`) and title; `PageHeader` used on tab screens with optional right-side gear link to `/settings`.
**Contract** — `GET /v1/me` → `{ user, families:[{id,name,role}] }`.
**Tests** — `TabBar.test.tsx › "five tabs in order"`, `› "unread badge has Bangla aria-label"`; `FamilyProvider.test.tsx › "falls back to first family when cookie family is gone"`, `› "no families redirects to /consent"`; `RoleGate.test.tsx › "viewer sees read-only message"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/shell`.
**Done when** — navigating between the five tabs in mock mode keeps the bar and the active state correct.

### T-WEB-08 · Error, empty and offline states; PWA basics
- **Closes:** FR-ONB-03, FR-ONB-02, NFR-03
- **Depends on:** T-WEB-07  · **Milestone:** M2 · **Layer:** web
**Why** — Plain Bangla messages with one next step for offline, server down and empty lists; the app shell works offline.
**Files**
- C `apps/web/app/error.tsx`, `app/(app)/error.tsx`, `app/not-found.tsx`, `components/shell/OfflineBanner.tsx`, `components/ui/Toast.tsx`, `lib/hooks/useOnline.ts`
- C `apps/web/app/manifest.ts`, `public/sw.js`, `public/icons/{192,512,maskable}.png`, `lib/pwa/register.ts`
**Steps**
1. Copy catalogue (bn): offline "ইন্টারনেট নেই। আপনার লেখা জমা থাকবে।"; server error "একটু সমস্যা হয়েছে। আবার চেষ্টা করুন।" with button "আবার চেষ্টা"; empty list hint per screen defined in each screen task.
2. `OfflineBanner` appears at the top under 1 s of `navigator.onLine === false` and on `fetch` network errors from the API client; it shows queued count from the chat/entry outboxes (T-WEB-33 and T-WEB-13 expose `useOutboxCount()`).
3. `sw.js`: precache `/`, `/offline`, fonts, icons with `cache-first` for `/_next/static/*`, `network-first` for navigations falling back to `/offline`; no API responses cached. Version constant `SW_VERSION` bumped via build hash.
4. `manifest.ts`: name "আমার পরিবার", short_name "পরিবার", `display: "standalone"`, `theme_color #1B5E20`, `background_color #FFF8EE`, icons.
5. `register.ts` registers `/sw.js` in production only.
**Tests** — `useOnline.test.ts › "reflects window online/offline events"`; `OfflineBanner.test.tsx › "shows queued count"`; `app/error.test.tsx › "retry button calls reset"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run && pnpm --filter @amar-poribar/web build`; `ls apps/web/public/sw.js apps/web/public/icons/192.png`.
**Done when** — Lighthouse-style check script `scripts/pwa-check.mjs` (fetches `/manifest.webmanifest`, validates required fields and that `sw.js` is served) exits 0 against `next start`.

### T-WEB-09 · Speech library (recognition, synthesis, availability)
- **Closes:** FR-VOICE-01, -04, -05, -07 (web), NFR-14
- **Depends on:** T-WEB-05  · **Milestone:** M2 · **Layer:** web
**Why** — Voice is the primary input; one tested wrapper replaces `lib/voice.ts` and detects when Bangla speech is unavailable (screen `D8`).
**Files**
- C `apps/web/lib/speech/{recognition.ts,synthesis.ts,availability.ts,useSpeechRecognition.ts,useSpeak.ts,speechQueue.ts}`; D `apps/web/lib/voice.ts`
**Steps**
1. Move the existing `useSpeechRecognition(lang)` and `speak()` code; fix: `recognition.continuous=false`, `interimResults=false`, 8 s no-speech timeout, map errors `not-allowed`→`mic_denied`, `no-speech`→`no_speech`, `network`→`offline`, `service-not-allowed`/missing ctor→`unsupported`.
2. `availability.ts`: `checkBanglaSupport()` returns `{ recognition: boolean, synthesis: boolean, banglaVoice: boolean }` (synthesis voices loaded via `voiceschanged` with 2 s timeout; `banglaVoice` = any voice with lang starting `bn`).
3. `speechQueue.ts`: serialises utterances, `cancelAll()`, rate 0.9, picks Bangla voice, falls back to `en-IN` for English text.
4. `useSpeak()` returns `{ speak(text,{interrupt}), stop, speaking }`; in Simple mode `autoSpeak` helper speaks results when `ap_simple=1`.
5. Amount-in-words helper re-exported from shared: `spokenAmount(paisa)`.
**Tests** — `recognition.test.ts › "maps not-allowed to mic_denied"`, `› "times out after 8 s of silence"`; `availability.test.ts › "banglaVoice false when no bn voice"`; `speechQueue.test.ts › "queues in order and cancels"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run lib/speech`; `grep -R "lib/voice" apps/web | wc -l` prints `0`.
**Done when** — `QuickAdd` uses the new hooks and its tests still pass.

### T-WEB-10 · A1 Login with phone and OTP, A7 wrong-code state
- **Closes:** FR-AUTH-01, -02, -07, -09 (return-to), AC-12
- **Depends on:** T-WEB-03, T-WEB-06; backend T-ID (OTP errors) or mocks  · **Milestone:** M1 · **Layer:** web
**Why** — Sign-in is the front door. Design files: `Login.dc.html` (A1), `OtpError.dc.html` (A7).
**Files**
- C `apps/web/app/(auth)/login/page.tsx`, `components/features/auth/{PhoneStep.tsx,OtpStep.tsx,OtpErrorBanner.tsx,ResendTimer.tsx}`
- C `apps/web/lib/auth/phone.ts` (normalise `01XXXXXXXXX` / `+8801…`, uses `BdPhoneSchema`)
**Steps**
1. **A1 layout**: logo tile 84 px green with home icon; title "আমার পরিবার" 34 px 700 green; subtitle "পরিবারের সব হিসাব, এক জায়গায়"; label "আপনার মোবাইল নম্বর দিন" 20 px; phone field 68 px high, 3 px green border, prefix "+৮৮", Bangla digits displayed (`০১৭১২ ৩৪৫ ৬৭৮`), helper "আমরা একটি ৬ সংখ্যার কোড এসএমএসে পাঠাব।"; label "কোডটি লিখুন" then `OtpBoxes`; "কোড আসেনি? আবার পাঠান (০:৪২)" countdown 60 s; primary "ঢুকুন" 72 px; footer "সাহায্য লাগলে বাড়ির কাউকে ফোন দিন।".
2. `PhoneStep` posts `/api/auth/otp/request`; on 200 show `OtpStep`; `otp_rate_limited` → banner with `retryAfterSeconds` ("এক ঘণ্টায় সর্বোচ্চ ৫ বার কোড চাওয়া যায়।").
3. `OtpStep` auto-submits on 6th digit; on `otp_invalid` render **A7**: all six boxes get 3 px `--danger` border, banner (icon + "কোডটি মেলেনি" 18 px 700 + "আবার দেখে লিখুন। আর {attemptsLeft} বার চেষ্টা করতে পারবেন."), buttons "নতুন কোড পাঠান" (outline green, 64 px) and "নম্বর ভুল? বদলান" (text), help card "কোড না এলে: …", disabled "ঢুকুন" (`#C9BBA3`) when `attemptsLeft` = 0; `otp_expired` → "কোডের মেয়াদ শেষ। নতুন কোড নিন।".
4. After success: `router.replace(next ?? "/")`; if the user has no family → `/consent`.
5. Dev convenience: when the response includes `devCode` (non-production), show a muted line "Dev OTP: 123456" (never in production builds: `process.env.NODE_ENV`).
**Contract** — `POST /api/auth/otp/request {phone}` → 200 `{sent:true}` | 429 `otp_rate_limited {retryAfterSeconds}`; `POST /api/auth/otp/verify {phone, code}` → 200 `{ok:true}` | 400 `otp_invalid {attemptsLeft}` | 410 `otp_expired`.
**Tests** — `OtpStep.test.tsx › "sixth wrong try shows attemptsLeft 0 and disables submit"` (AC-12), `› "paste fills six boxes and submits"`, `› "resend disabled until timer ends"`; `PhoneStep.test.tsx › "rejects 12345 with Bangla message"`, `› "normalises +8801712345678"`; `OtpErrorBanner.test.tsx › "has role=alert and icon"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/auth`; later `e2e/flows/ac-12-otp.spec.ts` (T-WEB-38).
**Done when** — mock-mode user can sign in with code `123456` and A7 appears for any other code.

### T-WEB-11 · D1 Welcome and A2 consent + create family
- **Closes:** FR-ONB-01, FR-AUTH-04, FR-AUTH-10, FR-FAM-01, FR-PRIV-01, -02
- **Depends on:** T-WEB-05, T-WEB-06; backend T-ID (consents), T-PRIV (`/v1/policy`)  · **Milestone:** M1 · **Layer:** web
**Why** — First run sets language/numerals/Simple mode, then records consent and creates the family. Design: `Welcome.dc.html` (D1), `Consent.dc.html` (A2).
**Files**
- C `apps/web/app/(auth)/welcome/page.tsx`, `app/(auth)/consent/page.tsx`, `components/features/onboarding/{LanguageChoice.tsx,NumeralChoice.tsx,SimpleModeToggle.tsx,ConsentList.tsx,PolicyDialog.tsx}`
- M `apps/web/middleware.ts` (first visit without `ap_loc` → `/welcome`)
**Steps**
1. **D1**: heading "স্বাগতম" with "Welcome to Amar Poribar"; "ভাষা · Language" two 72 px options **বাংলা / English** (selected = 3 px green border + `#E6F2E3`); "সংখ্যা · Numbers" **১২৩ / 123**; "সহজ মোড" row with one-line explanation "বড় লেখা, ছবি আর কথা। সব কিছু শুনিয়ে দেবে।"; note "পরে সেটিং থেকে বদলাতে পারবেন।"; primary "এগিয়ে চলুন" → `/login`. Choices write cookies immediately (T-WEB-05 `setPreference`).
2. **A2**: title "আপনার পরিবার তৈরি করুন", "ধাপ ১ / ২"; family name field 64 px (placeholder "যেমন: রহিম পরিবার"); currency chip "৳ বাংলাদেশি টাকা (BDT)" read-only; "আপনার তথ্য কীভাবে ব্যবহার হবে" card with three rows (group icon "শুধু আপনার পরিবারের সদস্যরা হিসাব দেখবে।", mic "কথা আপনার ফোনেই লেখা হয়। রেকর্ড সার্ভারে যায় না।", shield "এআই-এর জন্য ফোন নম্বর ও অ্যাকাউন্ট নম্বর পাঠানো হয় না। যেকোনো সময় তথ্য মুছে দিতে পারবেন।"); checkbox row "আমি রাজি আছি" (40 px box) with link "গোপনীয়তা নীতি" opening `PolicyDialog` that loads `GET /v1/policy?locale=`; primary "পরিবার তৈরি করুন" disabled until checked.
3. Submit: `POST /v1/me/consents {kind:"privacy", version, locale}` then `POST /v1/families {name}`; set `ap_fid`; go to `/`.
4. If `GET /v1/me` already lists a family, skip to `/`.
**Contract** — `GET /v1/policy?locale=bn|en` → `{version, text}`; `POST /v1/me/consents {kind, version, locale}` → 204; `POST /v1/families {name}` → family.
**Tests** — `LanguageChoice.test.tsx › "switching to English updates labels"` (AC-06), `ConsentList.test.tsx › "submit disabled until I agree"`, `PolicyDialog.test.tsx › "loads policy in current locale"`, `consent.page.test.tsx › "creates consent then family in order"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/onboarding app/\(auth\)`.
**Done when** — a new mock user passes welcome → login → consent → Home with cookies set.

### T-WEB-12 · A6 Join by invite link and F6 expired states
- **Closes:** FR-FAM-02, FR-AUTH-09, FR-ONB-03
- **Depends on:** T-WEB-10; backend T-FAM (`GET /v1/invites/:token` preview)  · **Milestone:** M1 · **Layer:** web
**Why** — Invite links used to be handled by `?invite=` in `FamilyHome`. They now have their own screens. Design: `Join.dc.html` (A6), `SessionExpired.dc.html` (F6).
**Files**
- C `apps/web/app/(auth)/join/[token]/page.tsx`, `app/(auth)/session-expired/page.tsx`, `components/features/family/InvitePreview.tsx`, `components/features/auth/ExpiredCards.tsx`
- M `apps/web/app/(app)/layout.tsx` (remove `?invite=` handling; legacy `/?invite=T` redirects to `/join/T`)
**Steps**
1. **A6**: three overlapping avatars (72 px, −16 px overlap), text "আব্বু আপনাকে ডেকেছেন", family name 32 px green, "৫ জন সদস্য · আপনি হবেন **সদস্য**"; card "যোগ দিলে আপনি পারবেন" with rows "খরচ লিখতে ও দেখতে", "পরিবারের সাথে কথা বলতে", "ব্যক্তিগত খরচ শুধু নিজে দেখতে"; "আমন্ত্রণের মেয়াদ আছে আর ৬ দিন।"; primary "যোগ দিন" 76 px; text button "এখন নয়".
2. Not signed in → keep the token in `sessionStorage` key `ap_pending_invite` (non-sensitive) and send to `/login?next=/join/TOKEN`.
3. "যোগ দিন" → `POST /v1/invites/:token/accept` → set `ap_fid`, toast "পরিবারে যোগ দিয়েছেন", go to `/`.
4. Errors: `invite_expired`/`invite_used`/`not_found` → show **F6 second card** "আমন্ত্রণের মেয়াদ শেষ" + "কোনো সমস্যা নেই। যিনি ডেকেছিলেন, তাঁকে নতুন লিংক পাঠাতে বলুন।" + button "আব্বুকে কম্পন দিন" (only if signed in and preview returned `inviter`; opens `/buzz?to=<id>`).
5. `/session-expired`: card "আবার ঢুকুন" + "আপনার নিরাপত্তার জন্য কিছুদিন পর আবার ঢুকতে হয়। আপনার হিসাব ঠিকই আছে।" + button "নম্বর দিয়ে ঢুকুন" → `/login?next=…`. Footer "সাহায্য লাগলে বাড়ির কাউকে ফোন দিন।"
**Contract** — `GET /v1/invites/:token` → `{familyName, memberCount, inviter:{id,name}, role, expiresAt}` | 404 `invite_not_found` | 410 `invite_expired`; `POST …/accept` → `{familyId}`.
**Tests** — `InvitePreview.test.tsx › "shows days left in Bangla digits"`, `join.page.test.tsx › "unsigned user is sent to login with next"`, `› "expired token shows F6 card"`, `› "accept stores ap_fid and redirects"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run app/\(auth\)/join`.
**Done when** — `/?invite=T` and `/join/T` both lead to the same flow in mock mode.

### T-WEB-13 · Home (Main): summary, budget strip, speak button, tiles, family, activity
- **Closes:** FR-HOME-01, FR-REP-01, FR-BUD-06, FR-PRES-01, FR-CAT (picker data), AC-01 (UI)
- **Depends on:** T-WEB-07, T-WEB-09; T-REP (summary), T-BUD, T-COMM (presence/activity) or mocks  · **Milestone:** M2 · **Layer:** web
**Why** — Home is the one screen every member sees daily. Design: `Main.dc.html`.
**Files**
- C `apps/web/app/(app)/page.tsx`, `components/features/home/{GreetingHeader.tsx,MonthCard.tsx,BudgetStrip.tsx,SpeakButton.tsx,ActionTiles.tsx,FamilyRow.tsx,ActivityFeed.tsx}`
- M `components/features/entry/QuickAdd.tsx` (becomes the logic behind `SpeakButton`; text box moves to `/add`)
**Steps**
1. Header: "শুভ সন্ধ্যা, {name}" (greeting by Dhaka hour: সুপ্রভাত/শুভ দুপুর/শুভ সন্ধ্যা/শুভ রাত্রি) + family title "আমার পরিবার" 26 px green; gear `IconButton` (`aria-label="সেটিং"`, 56 px) → `/settings`.
2. `MonthCard` (green, white text): "নভেম্বরে খরচ", amount 32 px, "গত মাসের চেয়ে ৳ ৩,২০০ বেশি", white pill button "শুনুন" (reads `GET …/ai/summary` `speechText` with `useSpeak`) and link to `/summary`. Data: `GET /v1/families/:id/reports/summary`.
3. `BudgetStrip` (amber `#FDEBCB`, text `#6B3F00`): "বাজারের বাজেট ৮০% শেষ" from `GET …/budgets` first row with level `warning|exceeded`; button "আম্মুকে জানান" → `/buzz?to=<adminId>&phrase=budget`. Hidden when no alert.
4. `SpeakButton`: full-width 84 px amber pill, mic icon 40 px, "বলে খরচ লিখুন"; click → `/add/voice` and starts recognition immediately (`?autostart=1`). Disabled state links to `D8` fallback card when unsupported.
5. `ActionTiles`: three equal tiles (84 px) "কম্পন" (amber, → `/buzz`), "কথা" (→ `/chat`), "ভিডিও" (→ `/call/new`).
6. `FamilyRow`: 56 px avatars with presence dot **and** `aria-label`; text under each ("আম্মু", status word অনলাইন/অফলাইন). Legend "সবুজ = অনলাইন / ধূসর = অফলাইন". Data: `GET /v1/families/:id/presence` plus live updates (T-WEB-31).
7. `ActivityFeed`: two latest items from conversation system cards and voice notes with play/amount; tap goes to the chat or `/txn/:id`.
8. Viewer role: hide `SpeakButton` and budget "জানান" button; show "আপনি শুধু দেখতে পারবেন।".
9. Simple mode on web: replace content with the `D3` layout (one huge mic, four picture tiles) — handled in T-WEB-05/23 via `data-simple`; this task exposes `HomeSimple.tsx` with: mic tile "বলুন", tiles "কম্পন", "কথা", "মাসের কথা শুনুন", "খরচ দেখুন", link "সাধারণ মোডে যান".
**Tests** — `MonthCard.test.tsx › "change line uses more/less words and colour"`, `› "listen speaks speechText"`; `BudgetStrip.test.tsx › "hidden without alerts"`, `› "tell someone links to buzz with recipient"`; `FamilyRow.test.tsx › "presence has word and aria-label"`; `home.page.test.tsx › "viewer has no speak button"`, `› "simple mode renders HomeSimple"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/home app/\(app\)/page`.
**Done when** — Home renders the design's sections in order at 390 px width without horizontal scroll (checked in T-WEB-40).

### T-WEB-14 · A3 Voice entry read-back, A4 category picker, D8 fallback
- **Closes:** FR-VOICE-01..03, -06, -07, FR-AI-01, -08, -13, AC-02 (UI), AC-08, AC-09
- **Depends on:** T-WEB-09, T-WEB-13  · **Milestone:** M2 · **Layer:** web
**Why** — Hear before you save. Design: `VoiceEntry.dc.html` (A3), `Picker.dc.html` (A4), `VoiceFallback.dc.html` (D8).
**Files**
- C `apps/web/app/(app)/add/voice/page.tsx`, `components/features/entry/{DraftReadBack.tsx,CategoryGrid.tsx,VoiceFallbackCard.tsx,useDraftFlow.ts}`
- C `apps/web/lib/entry/quickParse.ts` (port of the device quick parser is **not** needed on web; the server parse returns drafts; this file only maps `ParseResponse` → view model)
**Steps**
1. `useDraftFlow`: state machine `idle → listening → parsing → readback | needsCategory | error`; calls `POST /v1/families/:id/ai/parse {text, now}`; marks `source:"voice"` on every draft from speech; handles `429 ai_quota` → inline notice with link `/plans` and keeps text entry working (E7 card).
2. **A3** layout: line "আপনি বললেন:" with mic icon, transcript in quotes 22 px 600; card (2 px green border) with category icon tile 64 px, name "বাজার ও মুদি" 20 px 700, meta "খরচ · ক্যাশ · আজ", amount 52 px green "৳ ৮৫০", words line "আটশো পঞ্চাশ টাকা" (`spokenAmount`); button "আবার শুনুন" (speaker); text "ঠিক আছে?" centred; two buttons: round "না" (104 px, 3 px red outline) and "হ্যাঁ, রাখুন" (104 px, green, 28 px); text link "টাকা বা খাত বদলাতে চাই" → `/add?draft=…`.
3. On entering read-back, speak the draft with `draftToSpeech` (shared) once; in Simple mode also on every change.
4. **A4** (when `categoryKey` is null): header card "৳ ৫০০ · পাঁচশো টাকা · ক্যাশ · আজ" with speaker button; title "কিসের জন্য?" + "ছবিতে চাপ দিন, নামটি শোনা যাবে।"; 3×4 grid of 104 px tiles (icon 36 px + label 16 px; selected = 3 px green + ✓); focusing or tapping a tile speaks its name; sticky primary "বাজারে রাখুন" (label follows selection).
5. Save: `POST /v1/families/:id/transactions` with the draft (category id resolved from key), `Idempotency-Key`; on success toast "রাখা হয়েছে", update `qk.family(id).summary()`, go back to `/`.
6. **D8**: when `checkBanglaSupport()` shows no recognition or no Bangla voice, show `VoiceFallbackCard`: title "কথা বলা যাচ্ছে না", "এই ফোনে বাংলা ভয়েস নেই", "চিন্তা নেই। আপনি লিখেও খরচ রাখতে পারবেন।", button "বাংলা ভয়েস ইনস্টল করুন" (opens `https://support.google.com/…` in a new tab), "এখন লিখে রাখুন" focusing a text field with placeholder `লিখুন: "বাজার ৮৫০ ক্যাশ"`, shortcuts "এসএমএস পেস্ট" (→ `/add/sms`) and "মেমোর ছবি" (→ `/add/receipt`), note "উত্তর পড়ে শোনানোও এই ফোনে বন্ধ। লেখা দেখে নিন।" when synthesis missing.
**Tests** — `useDraftFlow.test.ts › "unknown category moves to needsCategory"` (AC-09), `› "voice drafts are marked source=voice"`, `› "ai_quota shows plans link"`; `DraftReadBack.test.tsx › "speaks the Bangla read-back sentence once"` (AC-08: expected sentence for 850 bazar cash), `› "no button smaller than 104px"`; `CategoryGrid.test.tsx › "tap speaks name and selects"`; `VoiceFallbackCard.test.tsx › "shown when no bn voice"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/entry`.
**Done when** — saying (fake recognition) "আজ বাজারে আটশো পঞ্চাশ টাকা ক্যাশে" produces ৳ ৮৫০ read-back and ✓ saves a transaction in mock mode.

### T-WEB-15 · A5 Paste bKash/Nagad SMS
- **Closes:** FR-AI-02, FR-TXN-04, AC-03, AC-04 (UI)
- **Depends on:** T-WEB-14  · **Milestone:** M2 · **Layer:** web
**Why** — Paste-in flow without any SMS permission. Design: `Sms.dc.html`.
**Files**
- C `apps/web/app/(app)/add/sms/page.tsx`, `components/features/entry/{SmsPaste.tsx,SmsPreview.tsx}`
**Steps**
1. Title "এসএমএস থেকে লিখুন", "বিকাশ, নগদ বা রকেটের মেসেজ পেস্ট করুন।"; dashed 2 px textarea (min 5 lines, 14 px); a "পেস্ট করুন" button using `navigator.clipboard.readText()` where permitted.
2. On input debounce 400 ms → `POST …/ai/parse {text}`; if the response `via==="template"` show green line "✓ বিকাশ মেসেজ চেনা গেছে · এআই লাগেনি"; else "এআই দিয়ে বোঝা হয়েছে".
3. `SmsPreview`: card "টাকা পাঠানো", amount 46 px green, key-value grid (কাকে / ফি / অ্যাকাউন্ট / সময় / ট্রানজ্যাকশন), recipient masked `০১XXXXX-৭৮৯`.
4. If server says `duplicate` (409 `duplicate_trx_id` on save or `isDuplicate` in preview) show amber banner "এই মেসেজ আগেই রাখা হয়েছে।" and disable save. Otherwise amber prompt "এই মেসেজ আগে রাখা হয়নি। কোন খাত?" with three suggested category buttons and "অন্যান্য".
5. Buttons: "না" (96 px, red outline) and "✓ রাখুন" (80 px height, green 24 px).
**Contract** — parse response includes `via: "template"|"quick"|"rule"|"llm"`, `drafts[].trxId`.
**Tests** — `SmsPaste.test.tsx › "template parse shows no-AI line"`, `› "duplicate trx shows banner and disables save"` (AC-04), `› "recipient digits masked"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/entry/Sms`.
**Done when** — pasting the design's sample SMS yields ৳ ২,০০০, fee ৳ ০, TrxID `9K4L2M7N` in mock mode.

### T-WEB-16 · D4 Add expense by hand
- **Closes:** FR-TXN-01, -05, -09, FR-ACC (account chips)
- **Depends on:** T-WEB-14  · **Milestone:** M2 · **Layer:** web
**Why** — Typed entry for people who prefer it. Design: `AddExpense.dc.html`.
**Files**
- C `apps/web/app/(app)/add/page.tsx`, `components/features/entry/{TransactionForm.tsx,TypeSegment.tsx,AccountChips.tsx,CategoryRow.tsx,PrivateToggle.tsx}`, `lib/entry/transactionSchema.ts` (Zod form schema)
**Steps**
1. Form (react-hook-form + zod): `type` segmented **খরচ / আয় / স্থানান্তর**; `amount` (`AmountInput`, digits ≥ 1, ≤ ৳1 crore) with the words line; `category` icon row (5 shown + "আরও" opens the A4 grid in a `Sheet`); `account` chips with "✓" on the selected one; "কে দিলেন?" select of members; "কবে?" chips আজ / গতকাল / other date input; `note` ("একটু লিখে রাখুন"), optional `fee`; `PrivateToggle` "ব্যক্তিগত (শুধু আমি দেখব)" with a lock icon.
2. Submit converts amount to paisa via `parseAmountToPaisa`; `POST …/transactions` with client `id` (UUID) and `Idempotency-Key`; offline: enqueue to IndexedDB `outbox.entries` (`lib/entry/outbox.ts`) and show "জমা থাকল, ইন্টারনেট এলে যাবে"; flush on `online` event.
3. Prefill from `?draft=` (A3 "বদলাতে চাই") and `?category=`.
4. Viewer role → RoleGate message instead of form.
**Tests** — `TransactionForm.test.tsx › "amount 850 shows আটশো পঞ্চাশ টাকা"`, `› "private toggle sends isPrivate"`, `› "offline submit queues and flushes on online"`, `› "income hides account 'who paid' label change"`; `transactionSchema.test.ts › "rejects zero and > 1 crore"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/entry/TransactionForm lib/entry`.
**Done when** — a manual expense appears in B1 list without reload.

### T-WEB-17 · D5 Transaction detail with undo, D7 category learning
- **Closes:** FR-TXN-03, -10, FR-AI-07, AC-07 (UI), AC-14 (restore)
- **Depends on:** T-WEB-16; backend T-LED (GET one, restore, merchant rules)  · **Milestone:** M2 · **Layer:** web
**Why** — Review, change and undo; teach the app merchant → category rules. Design: `TxnDetail.dc.html` (D5), `RuleLearn.dc.html` (D7).
**Files**
- C `apps/web/app/(app)/txn/[id]/page.tsx`, `components/features/ledger/{TransactionDetail.tsx,UndoBanner.tsx,RuleLearnPrompt.tsx,RuleList.tsx}`
**Steps**
1. **D5** header "খরচের বিস্তারিত"; undo banner (amber) "মুছে ফেলা হয়েছে। ৩০ দিন পর্যন্ত ফেরত পাবেন।" + button "ফেরত আনুন" calling `POST …/transactions/:id/restore`; card: category + time ("আজ, বিকাল ৫:১০"), amount `−৳ ৮৫০` 40 px, words; key-value rows অ্যাকাউন্ট / কে দিলেন / কীভাবে লেখা (কণ্ঠ থেকে | এসএমএস থেকে | ছবি থেকে | হাতে) / ট্রানজ্যাকশন নম্বর ("নেই (নগদ টাকা)") / লেখা / কে দেখবে ("শুধু আমি" when private); receipt thumbnail if `attachmentUrl`.
2. Buttons: "বদলান" (→ `/add?edit=:id`) and "মুছুন" (confirm `Dialog` "মুছে ফেলবেন?" with "না"/"হ্যাঁ, মুছুন"); Members who did not create it see disabled buttons and the text "আপনি শুধু নিজের খরচ বদলাতে পারেন।" (403 from API is also mapped to this text).
3. **D7**: after an edit that changes category from "অন্যান্য" (or empty) to another and the note looks like a merchant, show `RuleLearnPrompt` sheet: "আপনি খাত বদলালেন: অন্যান্য → বাজার", question `এরপর থেকে "শপনো" সবসময় বাজারে রাখব?` with speaker button, buttons "না" (red outline 64 px) and "হ্যাঁ" (green); yes → `POST /v1/families/:id/merchant-rules {pattern, categoryId}`.
4. `RuleList` (in `/categories` under "যা যা মনে রেখেছি"): rows `"স্বপ্ন" → বাজার` with delete (red 48 px, `aria-label="নিয়ম মুছুন"`); note "এই নিয়ম শুধু আপনার পরিবারের জন্য।"; `DELETE …/merchant-rules/:id`.
**Tests** — `TransactionDetail.test.tsx › "member cannot edit others' entry"` (AC-07), `› "undo restores within 30 days"`, `› "private row shows শুধু আমি"`; `RuleLearnPrompt.test.tsx › "yes posts a rule"`, `› "no does nothing"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/ledger`.
**Done when** — delete → banner → restore round-trips in mock mode.

### T-WEB-18 · D6 Receipt / memo photo to draft with split
- **Closes:** FR-AI-09, FR-TXN-07, -08, AC-36 (UI)
- **Depends on:** T-WEB-16; backend T-AI (receipt), T-LED (attachment, split)  · **Milestone:** M7 · **Layer:** web
**Why** — Photograph a handwritten memo and get drafts split by category. Design: `Receipt.dc.html`.
**Files**
- C `apps/web/app/(app)/add/receipt/page.tsx`, `components/features/entry/{ReceiptCapture.tsx,ReceiptResult.tsx}`, `lib/media/compressImage.ts`
**Steps**
1. `ReceiptCapture`: `<input type="file" accept="image/*" capture="environment">` plus drag-drop; `compressImage(file)` draws to canvas, max edge 1280 px, JPEG quality loop 0.8→0.5 until ≤ 300 KB; refuse input > 5 MB before compression with "ছবি অনেক বড়।".
2. POST to `/ai/receipt` (JSON with base64 as the existing `ReceiptRequestSchema` requires) → drafts with line items and category suggestions.
3. `ReceiptResult` (design): photo card "হাতে লেখা মেমো" with line list (চাল ২ কেজি ৩২০, …); note "ছবি ছোট করে পাঠানো হয়েছে (প্রায় ৩০০ KB)।"; success line "দুই খাতে ভাগ হয়েছে"; split rows (icon tile 48 px, "বাজার চাল, ডাল, তেল ৳ ৬২০", "ওষুধ নাপা ৳ ২৩০"); "মোট ৳ ৮৫০"; speaker line `শুনুন: "বাজার ছয়শো বিশ, ওষুধ দুইশো ত্রিশ"`; toggle "ছবি রাখুন (না রাখলে মুছে যাবে)"; buttons "না" and "দুটোই রাখুন".
4. Save creates a split group: `POST …/transactions` for each child with the same `splitGroupId` (client UUID); if "ছবি রাখুন" is on, request `POST …/transactions/:id/attachment` → presigned PUT → upload compressed image.
5. Plan check: `403 plan_required` → link to `/plans`.
**Tests** — `compressImage.test.ts › "output ≤ 300 KB and max edge 1280"` (uses a canvas mock), `› "rejects over 5 MB"`; `ReceiptResult.test.tsx › "children sum equals total"` (AC-36), `› "keep photo toggles attachment upload"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/entry/Receipt lib/media`.
**Done when** — mock receipt with three lines creates two split children and one attachment call.

### T-WEB-19 · B1 Transactions list with filters, cursor and CSV
- **Closes:** FR-TXN-02, FR-REP-04, AC-14 (UI), NFR-01
- **Depends on:** T-WEB-07; backend T-LED (cursor + filters)  · **Milestone:** M2 · **Layer:** web
**Why** — Today the web has no transaction list at all (GAP-WEB-03). Design: `Txns.dc.html`.
**Files**
- C `apps/web/app/(app)/list/page.tsx`, `components/features/ledger/{TransactionList.tsx,TransactionRow.tsx,FilterChips.tsx,MonthSwitcher.tsx}`, `lib/api/hooks/useTransactions.ts`
**Steps**
1. Header "খরচের তালিকা" with outline button "CSV নিন" → `GET …/reports/export.csv?month=` opened via `window.location` to the proxy path (the proxy keeps `content-disposition`).
2. `MonthSwitcher` (‹ month ›, 48 px buttons, label from `monthLabel`).
3. `FilterChips`: সবাই / one chip per member / accounts (ক্যাশ, বিকাশ…) — single-select per group, state in URL search params (`?member=&account=&category=`).
4. `useTransactions(filters)` = `useInfiniteQuery` on `GET …/transactions?month&memberId&accountId&categoryId&limit=50&cursor=` with `getNextPageParam: p => p.nextCursor`; "আরও দেখুন" button plus auto-load via `IntersectionObserver` sentinel.
5. Rows: 48 px tile with first letter, name, "আম্মু · ক্যাশ · কণ্ঠ থেকে" meta, amount right (`−৳` danger, `+৳` green), private rows show lock icon + "শুধু আপনি দেখছেন"; day group headers "আজ", "গতকাল", date.
6. Empty state: icon + "এই মাসে কিছু লেখা হয়নি।" + button "+ নতুন খরচ লিখুন".
7. Sticky primary "+ নতুন খরচ লিখুন" above the tab bar. Viewer role: replaced by "আপনি শুধু দেখতে পারবেন।".
**Tests** — `TransactionList.test.tsx › "loads 3 pages of 50 for 120 rows in stable order"` (AC-14), `› "filters are reflected in the URL and request"`, `› "private rows show lock and label"`, `› "empty state offers add"`; `MonthSwitcher.test.tsx › "next from December goes to January"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/ledger/TransactionList`.
**Done when** — scrolling 120 mock rows loads exactly 3 requests.

### T-WEB-20 · B2 Monthly summary with Listen, B5 Ask by voice
- **Closes:** FR-AI-11, FR-VOICE-04, -05, -08, FR-AI-10, AC-10 (UI)
- **Depends on:** T-WEB-09, T-WEB-13; T-AI (summary, ask)  · **Milestone:** M2 (summary), M7 (Ask) · **Layer:** web
**Why** — The month explained in plain words, and answers by voice. Design: `Summary.dc.html` (B2), `Ask.dc.html` (B5).
**Files**
- C `apps/web/app/(app)/summary/page.tsx`, `app/(app)/ask/page.tsx`, `components/features/ai/{SummaryCard.tsx,ListenButton.tsx,AskThread.tsx,HoldToTalk.tsx,SuggestedQuestions.tsx}`
**Steps**
1. **B2**: small month label, title "এ মাস কেমন গেল?" 30 px green; white card with the `text` from `GET …/ai/summary?month&locale` (sentences at 22 px; amounts bold, the change amount in danger when spending rose; tip in a green-100 block 20 px); note "সংখ্যাগুলো আপনার হিসাব থেকে নেওয়া, এআই বানায়নি।"; giant button "শুনুন" (100 px amber, speaker icon) which speaks `speechText`; helper "টাকার অঙ্ক কথায় পড়ে শোনানো হবে: …". While speaking the button reads "থামুন".
2. Simple mode: auto-speak once when the page opens (`autoSpeak`).
3. **B5**: title "আমার পরিবারকে জিজ্ঞেস করুন", "আপনার হিসাব থেকেই উত্তর আসবে।"; chat bubbles (user green right, answer white left with replay "আবার শুনুন" 56 px); privacy line "ব্যক্তিগত খরচ এখানে ধরা হয়নি।"; chips "গত মাসের চেয়ে কী বেড়েছে?", "বিদ্যুৎ বিল কত?" (52 px min); `HoldToTalk` 104 px amber circle with halo `#FDEBCB`, label "চেপে ধরে বলুন", alt link "লিখে জিজ্ঞেস করুন" opening a text field.
4. Ask calls `POST …/ai/ask {question}`; speak the answer automatically if the question was spoken; `403 plan_required` → card linking `/plans`; `429 ai_quota` → E7 quota card.
**Tests** — `SummaryCard.test.tsx › "amounts bold and change coloured"`, `ListenButton.test.tsx › "speaks speechText and toggles to stop"` (AC-10), `AskThread.test.tsx › "spoken question is answered aloud"`, `› "quota error shows plans link"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/ai`.
**Done when** — screen text and speech text show the same figures (digits vs words) in mock mode.

### T-WEB-21 · B3 Budgets with alerts and "tell someone"
- **Closes:** FR-BUD-01, -02, -06, -07, AC-05 (UI)
- **Depends on:** T-WEB-07; T-BUD  · **Milestone:** M2 · **Layer:** web
**Why** — Replaces the inline `Budgets` component. Design: `Budgets.dc.html`.
**Files**
- C `apps/web/app/(app)/budget/page.tsx`, `components/features/budget/{BudgetCard.tsx,BudgetEditSheet.tsx,BudgetStatus.tsx}`
- M/D `components/features/budget/BudgetList.tsx`
**Steps**
1. Title "মাসের বাজেট", sub "নভেম্বর ২০২৬ · গত মাসের বাজেট নিজে থেকেই চলে এসেছে" (only when `inherited`).
2. `BudgetCard`: name, "৳ spent / ৳ limit", 14 px bar, `BudgetStatus` = icon + word: ঠিক আছে (check, green), "৮০% পার হয়েছে · সাবধান" (warning, amber), "বাজেট শেষ · ৳ ৫০০ বেশি" (circle-exclamation, red). Border colour follows status but the word is always shown. Over-budget card has button "আম্মুকে কম্পন দিন" → `/buzz?to=…&phrase=budget`.
3. Festival card (dashed) "ঈদুল আযহা (উৎসবের বাজেট)", "১৫ – ২০ জুন · ৳ ২০,০০০" linking `/festival/new`.
4. Footer: primary "+ বাজেট দিন" (opens `BudgetEditSheet`, reuses the existing PUT logic: blank clears, unreadable input ignored) and a 72 px amber speaker button that reads all statuses aloud.
5. Owner/Admin edit; others see read-only (no "+ বাজেট দিন").
**Tests** — `BudgetCard.test.tsx › "exceeded shows word, icon and over amount"`, `› "buzz button only on exceeded"`; `BudgetEditSheet.test.tsx › "blank clears and sends limit 0"` (ported from existing behaviour), `› "member cannot open sheet"`; `budget.page.test.tsx › "reads statuses aloud"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/budget`.
**Done when** — design's four cards render from fixtures.

### T-WEB-22 · B4 Family tab (members, roles, invite) and F2 switch family
- **Closes:** FR-FAM-02, -03, -04, -07, -10, AC-07
- **Depends on:** T-WEB-07; T-FAM  · **Milestone:** M1 · **Layer:** web
**Why** — Replaces inline `Members`, adds buzz/chat buttons and family switching. Design: `Members.dc.html` (B4), `FamilySwitch.dc.html` (F2).
**Files**
- C `apps/web/app/(app)/family/page.tsx`, `app/(app)/switch-family/page.tsx`, `components/features/family/{MemberRow.tsx,RoleSelect.tsx,InviteSheet.tsx,TransferOwnershipDialog.tsx,FamilyCard.tsx}`
**Steps**
1. Header: family name 26 px green, "{n} জন সদস্য · কম্পন বা কথা পাঠাতে ছবিতে চাপ দিন", gear.
2. `MemberRow`: 48 px avatar, name, role pill; right-side 48 px round buttons: buzz (amber, `aria-label="কম্পন"`) and chat (green) — or video (for viewer rows) per design; own row has none; pending invite row dashed "আমন্ত্রণ পাঠানো হয়েছে · ৬ দিন বাকি".
3. Role rules mirrored from `families/domain/roles.ts`: `canManage`, `assignable` (keep the existing client logic from the old `Members`); role change via `RoleSelect` inline; remove with red 48 px icon + confirm dialog; "পরিবার ছাড়ুন" for self.
4. Footer buttons: "+ নম্বর দিয়ে ডাকুন" (phone invite sheet: phone + role) and "লিংক পাঠান (৭ দিন চলবে)" (create link, copy and `navigator.share` when available).
5. `TransferOwnershipDialog` for the owner: choose an admin, confirm text "মালিক বদলালে আপনি অ্যাডমিন হবেন।" → `POST …/transfer-ownership`.
6. Plan limit: `plan_member_limit` error → dialog with link `/plans`.
7. **F2**: title "কোন পরিবার?", "আপনি দুটি পরিবারে আছেন। ছবিতে চাপ দিন।"; `FamilyCard` per family: avatar group, name, role pill, member count, "✓ এখন এটি খোলা আছে" on active, badges "৩টি নতুন" (unread) and "১টি বাজেট"; buttons "নতুন পরিবার" and "আমন্ত্রণ নিয়ে যোগ দিন"; note "প্রতিটি পরিবারের হিসাব আলাদা থাকে। এক পরিবারের খরচ অন্য পরিবার দেখতে পায় না।" Selecting sets `ap_fid` and clears the React Query cache for the old family.
**Tests** — `MemberRow.test.tsx › "own row has no buzz button"`, `› "viewer row has video button"`; `family.page.test.tsx › "admin cannot change another admin"`, `› "plan limit opens plans dialog"`; `FamilyCard.test.tsx › "switching sets ap_fid and clears cache"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/family app/\(app\)/family`.
**Done when** — all role rules from the old component are covered by tests.

### T-WEB-23 · B6 Settings and F8 Profile (preferences, Simple mode, reminders)
- **Closes:** FR-AUTH-04, FR-NOTIF-05, FR-NOT-02, FR-PRES-02, FR-VOICE-09, FR-ONB
- **Depends on:** T-WEB-05, T-WEB-07; T-ID (`PATCH /v1/me`), T-NOTIF (preferences)  · **Milestone:** M2 · **Layer:** web
**Why** — Change language, numerals, Simple mode, reminder and quiet hours. Design: `Settings.dc.html` (B6), `Profile.dc.html` (F8).
**Files**
- C `apps/web/app/(app)/settings/page.tsx`, `app/(app)/profile/page.tsx`, `components/features/settings/{SettingRow.tsx,SwitchRow.tsx,SegmentRow.tsx,TimeRow.tsx,QuietHoursRow.tsx,NameEditor.tsx}`
**Steps**
1. **B6** groups (cards): (1) সহজ মোড (green-100 row, 19 px 700, sub "বড় লেখা, শুধু ছবি, সব কিছু শুনিয়ে দেবে") · ভাষা (বাংলা/English pills) · সংখ্যা (১২৩/123) · "রোজ মনে করান" (time picker, default রাত ৯:০০) · "কম্পন ও আওয়াজ" with "রাত ১০টা থেকে সকাল ৬টা চুপ" (quiet-hours range); (2) "খরচের তালিকা নামান (CSV)", "খাত ও অ্যাকাউন্ট" (→ `/categories`, `/accounts`), "কীভাবে ব্যবহার করবেন (শুনুন)" (speaks a fixed Bangla guide); (3) "গোপনীয়তা নীতি", red "আমার তথ্য মুছে দিন" → `/delete-account`. Row height ≥ 68 px, switches 56×32.
2. **F8**: avatar + name with "বদলান" (inline editor), phone `০১৭১২ ৩৪৫ ৬৭৮` (read-only), language, numerals, simple mode, daily reminder "রাত ৯:০০ টায় · সময় বদলান", presence hide toggle "আমাকে অফলাইন দেখান" (`PUT /v1/me/notification-preferences {hidePresence}`), links to policy and delete.
3. Every change calls `setPreference` (T-WEB-05) and `PUT /v1/me/notification-preferences`; optimistic update with rollback on error and toast "সেভ হয়নি। আবার চেষ্টা করুন।".
4. "সাধারণ/সহজ মোড" toggle immediately switches `data-simple`.
**Contract** — `GET|PUT /v1/me/notification-preferences` → `{ kinds:{budget,reminder,nudge,chat,call}, quietStart:"22:00", quietEnd:"06:00", dailyReminderTime:"21:00", hidePresence }`.
**Tests** — `SwitchRow.test.tsx › "is a real checkbox with label"`, `QuietHoursRow.test.tsx › "default 22:00–06:00 shown in Bangla digits"`, `settings.page.test.tsx › "simple mode toggles data-simple and persists"`, `› "failed save rolls back"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/settings`.
**Done when** — toggling language on Settings changes every visible label on the page.

### T-WEB-24 · E1 Accounts, E2 Categories
- **Closes:** FR-ACC-01..04, FR-CAT-01..03
- **Depends on:** T-WEB-07; T-LED (balances)  · **Milestone:** M2 · **Layer:** web
**Why** — Replaces the inline `ManageLists`. Design: `Accounts.dc.html`, `Categories.dc.html`.
**Files**
- C `apps/web/app/(app)/accounts/page.tsx`, `app/(app)/categories/page.tsx`, `components/features/ledger/{AccountCard.tsx,AccountForm.tsx,AccountTypeChips.tsx,CategoryTile.tsx,CategoryEditSheet.tsx,IconPicker.tsx}`; D `components/features/ledger/ManageLists.tsx`
**Steps**
1. **E1**: title "অ্যাকাউন্ট", "টাকা কোথায় কোথায় আছে", total line "সব মিলিয়ে আছে ৳ ১,২৪,৮৫০" (sum of balances); `AccountCard` 48 px type icon tile, name, "সবার জন্য"/"মালিক: আম্মু", balance right; section "নতুন অ্যাকাউন্ট": type chips (বিকাশ, ক্যাশ, নগদ, রকেট, উপায়, ব্যাংক, কার্ড, অন্য), name, "শুরুতে কত টাকা ছিল?" (`AmountInput`), primary "অ্যাকাউন্ট যোগ করুন". Archive via long press / "বন্ধ করুন" button (PATCH `archived:true`).
2. **E2**: tabs "খরচ" / "আয়"; hint "চেপে ধরলে নাম বদলানো, ছবি বদলানো বা লুকানো যাবে।"; 3-column grid of 100 px tiles (icon 32 px + name; hidden = dashed, grey, "লুকানো"); income categories listed as "বেতন · ব্যবসা · রেমিট্যান্স · ভাড়া পাওয়া · অন্যান্য"; buttons "নতুন খাত" and "নাম বদল". `CategoryEditSheet`: name bn/en, `IconPicker` (the fixed 20-icon set from shared), hide/show.
3. Owner/Admin only for edits; members see read-only lists.
4. Include `RuleList` from T-WEB-17 below the grid.
**Tests** — `AccountCard.test.tsx › "shows balance in Bangla digits"`, `AccountForm.test.tsx › "type chips are single-select"`, `› "opening balance converts to paisa"`; `CategoryEditSheet.test.tsx › "hide keeps category in old transactions"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/ledger`.
**Done when** — all behaviours of the deleted `ManageLists` exist with tests.

### T-WEB-25 · E3 Recurring bills, E4 Festival budget
- **Closes:** FR-REC-01..03, FR-BUD-04, FR-NOT-03
- **Depends on:** T-WEB-21; T-REC, T-BUD  · **Milestone:** M7 · **Layer:** web
**Why** — Monthly bills as one-tap drafts and festival planning. Design: `Recurring.dc.html` (E3), `FestivalNew.dc.html` (E4).
**Files**
- C `apps/web/app/(app)/recurring/page.tsx`, `app/(app)/festival/new/page.tsx`, `components/features/recurring/{DraftCard.tsx,TemplateRow.tsx,TemplateForm.tsx}`, `components/features/budget/{FestivalForm.tsx,SplitBars.tsx}`
**Steps**
1. **E3** title "প্রতি মাসের খরচ"; amber/green `DraftCard` "এ মাসের খসড়া": "বাসা ভাড়া ৳ ১২,০০০ দেওয়া হয়েছে?" with "আজ ৫ তারিখ · ক্যাশ থেকে" and buttons "না" (skip) and "হ্যাঁ, রাখুন" (confirm); list "সব নিয়মিত খরচ" rows "বাসা ভাড়া · প্রতি মাসের ৫ তারিখ · ৳ ১২,০০০"; chip "২ দিন আগে মনে করান"; primary "নতুন নিয়মিত খরচ" opens `TemplateForm` (name, amount, category, account, day 1–28, start, optional end, remind days).
2. APIs: `GET …/recurring/drafts`, `POST …/recurring/:id/confirm`, `POST …/recurring/:id/skip`, `GET|POST|PATCH …/recurring`.
3. **E4** title "উৎসবের বাজেট": "কোন উৎসব?" select (ঈদুল ফিতর, ঈদুল আযহা, পূজা, পহেলা বৈশাখ, অন্য), dates "শুরু ১৫ জুন" / "শেষ ২০ জুন" (date inputs), "মোট কত টাকা?" (`AmountInput`), "কোথায় কত? (আমরা একটা ভাগ ঠিক করে দিয়েছি)" `SplitBars` with −/+ 48 px steppers (৳ ৫০০ steps) for পশু/বাজার/কাপড়/দান summing to total; status "মোট মিলেছে · বাকি ৳ ০" (icon + word, red when not equal and Save disabled); primary "বাজেট রাখুন" → `POST …/festival-budgets`.
**Tests** — `DraftCard.test.tsx › "confirm creates once and removes card"`, `› "skip hides for the month"`; `TemplateForm.test.tsx › "day 31 rejected"`; `SplitBars.test.tsx › "total mismatch disables save"`, `› "steppers keep sum"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/recurring components/features/budget/Festival`.
**Done when** — AC-38-style trend/festival fixtures render without errors.

### T-WEB-26 · E5 Reports (member/account/trend) and E6 Viewer remittance
- **Closes:** FR-REP-02, -03, -05, -06, FR-FAM-05, BR-13
- **Depends on:** T-WEB-07; T-REP (trend, remittances)  · **Milestone:** M7 · **Layer:** web
**Why** — Charts without a chart library. Design: `Reports.dc.html` (E5), `Remit.dc.html` (E6).
**Files**
- C `apps/web/app/(app)/reports/page.tsx`, `app/(app)/remit/page.tsx`, `components/features/reports/{BarList.tsx,ColumnChart.tsx,SegmentedReport.tsx,TrendPanel.tsx,RemitCard.tsx}`
**Steps**
1. `BarList`: rows grid `88px 1fr 72px` (name, 16 px bar, amount); `ColumnChart`: flex columns (div heights as percent of max) with month labels (জুন … নভে), accessible as a `<table>` inside `<details>` for screen readers and a visible caption.
2. **E5**: three stat tiles (আয় ৳ ৬৫,০০০, খরচ ৳ ৪২,৫০০, বাকি ৳ ২২,৫০০), line "গত মাসের চেয়ে ৳ ৩,২০০ বেশি খরচ", segmented খাত / সদস্য / অ্যাকাউন্ট (from `byCategory|byMember|byAccount`), "মাসে মাসে খরচ" with ৬ মাস / ১২ মাস (from `GET …/reports/trend?months=6|12&categoryId=`), "CSV নিন".
3. **E6** (role `viewer` home for Tanvir): header "রিয়াদ থেকে · তানভীর / দেশের হিসাব" with pill "দর্শক"; banner "আপনি শুধু দেখতে পারবেন। খরচ লেখা যাবে না।"; card "এ মাসে পাঠিয়েছেন ৳ ৪০,০০০" and "এর মধ্যে খরচ হয়েছে ৳ ৩৫,৬০০ (৮৯%)" with bar; "কোথায় খরচ হলো?" `BarList`; balances row "ক্যাশ ৳ ৮,৪৫০ · বিকাশ ৳ ১২,৩০০ · ব্যাংক ৳ ৯৫,০০০"; note "ব্যক্তিগত খরচ এখানে দেখানো হয় না।"; button "পরিবারকে কম্পন দিন". Data: `GET …/reports/remittances`. Viewers are redirected from `/` to `/remit`.
4. Viewers must never call `/transactions` (guard in `useTransactions` + a test).
**Tests** — `ColumnChart.test.tsx › "heights scale to max and zero month is empty"`, `› "has table alternative"`; `RemitCard.test.tsx › "percentage is rounded and in Bangla digits"`; `remit.page.test.tsx › "viewer never requests transactions"`; `reports.page.test.tsx › "switching segment changes rows"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/reports app/\(app\)/remit`.
**Done when** — no chart dependency in `package.json` (`grep -E "chart|d3|recharts" apps/web/package.json` prints nothing).

### T-WEB-27 · E7 Plans, payment and AI quota card
- **Closes:** FR-BILL-01, -02, -04, -06, FR-AI-12, FR-FAM-10
- **Depends on:** T-WEB-07; T-BILL, T-AI (usage)  · **Milestone:** M8 · **Layer:** web
**Why** — Upgrade path and graceful quota exhaustion. Design: `Plans.dc.html`.
**Files**
- C `apps/web/app/(app)/plans/page.tsx`, `components/features/billing/{PlanCard.tsx,QuotaCard.tsx,CheckoutButtons.tsx,InvoiceList.tsx}`
**Steps**
1. Quota card (amber) at the top when `GET …/ai/usage` says exhausted (or arrived with `?reason=quota`): "এ মাসের এআই শেষ। হাতে লিখে বা অফলাইন কথায় চলবে।".
2. Cards from `GET /v1/plans`: **ফ্রি** (✓ এখন আছে; "১টি পরিবার, ৩ জন সদস্য", "মাসে ১০০টি এআই লেখা", "৬ মাসের হিসাব"), **পরিবার প্লাস ৳ ৯৯ / মাস** ("৮ জন সদস্য, সব পুরনো হিসাব", "মাসে ১,০০০টি এআই লেখা", "রসিদের ছবি, "জিজ্ঞেস করুন""), **প্রবাসী ৳ ১৪৯ / মাস** ("প্লাসের সব কিছু", "রেমিট্যান্স পরিকল্পনা", "রিয়াল/দিরহাম/রিঙ্গিত থেকে টাকা"). Current plan has a 3 px green border and a "✓" word.
3. Note "আমরা আপনার বিকাশের পিন চাই না।"; buttons "বিকাশ দিয়ে দিন" and "নগদ দিয়ে দিন" → `POST …/subscription/checkout {plan, provider}` → redirect to `checkoutUrl`; return route `/plans?status=success|failed` shows a banner.
4. Owner only; others see read-only cards and "মালিক প্ল্যান বদলাতে পারেন।".
5. Past-due and cancel states per FR-BILL-04 with words (বকেয়া — ৩ দিন সময় আছে, মেয়াদ শেষে বন্ধ হবে); `InvoiceList` with PDF links.
**Tests** — `PlanCard.test.tsx › "current plan marked with word and border"`; `CheckoutButtons.test.tsx › "redirects to checkoutUrl"`, `› "disabled for non-owner"`; `plans.page.test.tsx › "quota card shown when exhausted"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/billing`.
**Done when** — a mock checkout returns to `/plans?status=success` and shows "প্ল্যান চালু হয়েছে".

### T-WEB-28 · F3 Notifications inbox
- **Closes:** FR-NOTIF-04, -05, FR-NOT-01..03, FR-BUD-02
- **Depends on:** T-WEB-07, T-WEB-09; T-NOTIF (inbox)  · **Milestone:** M3 · **Layer:** web
**Why** — Every alert, invite and reminder in one list that can be heard. Design: `Notifications.dc.html`.
**Files**
- C `apps/web/app/(app)/notifications/page.tsx`, `components/features/notifications/{InboxItem.tsx,InboxList.tsx,ListenAllButton.tsx}`, `lib/api/hooks/useInbox.ts`
**Steps**
1. Title "খবর" and top-right "সব শুনুন" (`ListenAllButton` speaks every unread item's `speechText` in order via `speechQueue`).
2. `InboxItem`: 48 px kind tile (বাজেট ৮০% amber, আমন্ত্রণ green, রোজকার মনে করানো blue, বিল মনে করানো, কম্পন), title + body, time, 48 px listen button (`aria-label="শুনুন"`); invite items have buttons "যোগ দিন"/"না".
3. Footer "রোজকার মনে করানোর সময়: রাত ৯:০০" linking to settings.
4. `useInbox` = infinite query `GET /v1/inbox?cursor=`; marking read with `POST /v1/inbox/read {upTo}` when the page is visible 1.5 s; live items from `inbox` WebSocket events (T-WEB-31).
5. Empty: "কোনো নতুন খবর নেই।".
**Tests** — `InboxList.test.tsx › "unread first, read after"`, `ListenAllButton.test.tsx › "speaks items in order"`, `InboxItem.test.tsx › "invite item shows accept/decline"`, `useInbox.test.ts › "marks read after delay"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/notifications`.
**Done when** — new `inbox` events appear at the top without reload.

### T-WEB-29 · F5 Shared bazaar list
- **Closes:** FR-SHOP-01..03, AC-37 (UI)
- **Depends on:** T-WEB-31 (realtime); T-SHOP  · **Milestone:** M7 · **Layer:** web
**Why** — A list the whole family edits at once. Design: `Bazaar.dc.html`.
**Files**
- C `apps/web/app/(app)/bazaar/page.tsx`, `components/features/shopping/{ItemRow.tsx,AddItemBar.tsx,ToExpenseButton.tsx}`, `lib/api/hooks/useShopping.ts`
**Steps**
1. Title "বাজারের তালিকা", "পরিবারের সবাই লিখতে ও টিক দিতে পারবে।"; rows: 48 px check box (`<input type=checkbox>` styled, label "কেনা হয়েছে"), "চাল · ৫ কেজি", "আম্মু লিখেছেন · কেনা হয়েছে ৳ ৩৫০"; unchecked "বাকি ৳ ২,৮০০".
2. Summary cards "কেনা হয়েছে (২টি) ৳ ৬১০" and "বাকি আছে (২টি) আনুমানিক ৳ ২,৯৮০".
3. `AddItemBar` with mic (voice add: "চাল দুই কেজি" → name "চাল", qty "২ কেজি" via a small Bangla-number parser in `lib/shopping/parseItem.ts`) and text input.
4. `ToExpenseButton`: "বাজারে ৳ ৬১০ লিখুন" → `POST …/shopping-lists/:id/to-expense` → navigates to `/add?draft=` with the draft; helper text "চাপ দিলে খরচের খসড়া হবে। শুনে ✓ দিলে সেভ হবে।".
5. Realtime: `shopping.item` events patch the query cache; edits are optimistic with last-write-wins per item (`updatedAt`).
**Tests** — `ItemRow.test.tsx › "checking marks bought by me"`, `parseItem.test.ts › "চাল দুই কেজি → {চাল, ২ কেজি}"`, `useShopping.test.ts › "remote event updates list in place"` (AC-37), `ToExpenseButton.test.tsx › "sums checked estimated prices"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/shopping lib/shopping`.
**Done when** — two browser contexts in mock WS server see each other's ticks within 1 s.

### T-WEB-30 · F7 Delete my data and export
- **Closes:** FR-AUTH-05, FR-PRIV-03, -04, FR-FAM-07, AC-27, AC-28 (UI)
- **Depends on:** T-WEB-22, T-WEB-23; T-PRIV  · **Milestone:** M5 · **Layer:** web
**Why** — Right to export and erase (PDPO). Design: `DeleteAccount.dc.html`.
**Files**
- C `apps/web/app/(app)/delete-account/page.tsx`, `components/features/privacy/{DeleteSummary.tsx,ExportButton.tsx,ConfirmPhone.tsx,OwnerBlocker.tsx}`
**Steps**
1. Title "আমার তথ্য মুছুন"; two cards: "যা মুছে যাবে" (নাম, ফোন নম্বর ও সেটিং; ঢোকার অনুমতি) and "যা থেকে যাবে" ("পরিবারের হিসাবে আপনার লেখা খরচ, কিন্তু আপনার নাম ছাড়া").
2. `OwnerBlocker` if role is owner of a family with other members: amber "আপনি রহিম পরিবারের মালিক। মোছার আগে আম্মুকে মালিক করে দিন।" + "মালিক বদলান" (opens `TransferOwnershipDialog`); delete button disabled until resolved.
3. `ExportButton` "আগে আমার তথ্য ডাউনলোড করুন": `POST /v1/me/export` → poll `GET /v1/me/export/:id` every 3 s until `ready` → download link (valid 7 days); status words "তৈরি হচ্ছে…", "তৈরি হয়েছে".
4. `ConfirmPhone`: label "নিশ্চিত করতে ফোন নম্বরের শেষ ৩ সংখ্যা লিখুন" (3 `OtpBoxes`); red button "আমার তথ্য মুছে দিন" (72 px) enabled only when digits match; note "৩০ দিনের মধ্যে সব মুছে যাবে। এর মধ্যে মত বদলালে আবার ঢুকলেই থাকবে।".
5. Submit: `POST /v1/me/erasure {confirmLast3}` → clear cookies via `/api/auth/logout` → `/welcome` with toast.
**Tests** — `ConfirmPhone.test.tsx › "button enabled only on matching last 3 digits"`, `OwnerBlocker.test.tsx › "blocks while other members exist"`, `ExportButton.test.tsx › "polls until ready"`, `delete-account.page.test.tsx › "logout after erasure request"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/privacy`.
**Done when** — erasure request in mock mode ends on `/welcome` with no cookies.

### T-WEB-31 · Realtime client (WebSocket) and cache bridge
- **Closes:** GAP-WEB-05, SRS §5.4, FR-PRES-01, FR-NOTIF-07, NFR-17
- **Depends on:** T-WEB-04, T-WEB-07; T-COMM (WS endpoint) or `mocks/ws-server.ts`  · **Milestone:** M3 · **Layer:** web
**Why** — Buzz, chat, presence, shopping and calls all ride one socket.
**Files**
- C `apps/web/lib/realtime/{socket.ts,protocol.ts,RealtimeProvider.tsx,useRealtime.ts,bridge.ts,backoff.ts}`
- C `apps/web/mocks/ws-server.ts` (Node `ws` server implementing the SRS §5.4 protocol for tests and `AP_MOCK=1`)
**Steps**
1. `protocol.ts`: Zod discriminated union for every S→C and C→S frame in SRS §5.4 (`nudge`, `nudge.state`, `msg`, `msg.receipt`, `msg.deleted`, `presence`, `typing`, `inbox`, `shopping.item`, `call.*`, `ack`, `err`, `pong`).
2. `socket.ts` class `RealtimeSocket`: `connect()` fetches `/api/auth/ws-token`, opens `NEXT_PUBLIC_WS_URL`, sends `{t:"auth", token, deviceId, familyId}` within 5 s (`deviceId` = UUID in `localStorage` key `ap_device` — non-sensitive); status `connecting|open|closed`.
3. Heartbeat: `ping` every 25 s; if no `pong` within 10 s close and reconnect.
4. Reconnect: `backoff.ts` exponential 1 s → 30 s with ±20% jitter; on close code 4401 refresh the token once; a second 4401 → `onSessionExpired()`; pause while `document.hidden` for > 5 minutes and resume on `visibilitychange`.
5. `send(frame, {ack:true})` returns a Promise resolved by `ack` with the same `id` or rejected on `err` / 8 s timeout; frames are queued while not `open` (max 50) and flushed in order after auth.
6. `useRealtime()` → `{status, send, on(type, handler)}`; `RealtimeProvider` is mounted in `(app)/layout.tsx` only when a family is active; resubscribes when the family changes.
7. `bridge.ts`: `msg` → prepend to `qk.messages(cid)` and bump conversation list/unread; `msg.receipt` → patch receipts; `msg.deleted` → tombstone; `presence` → `qk.presence()`; `inbox` → prepend `qk.inbox()` and badge; `shopping.item` → patch list; `nudge` → open the incoming overlay (T-WEB-32); `call.invite` → open incoming call UI (T-WEB-35).
8. On every reconnect call `GET …/conversations`, `GET /v1/inbox`, `GET …/presence` to catch missed events by cursor (SRS §8.5).
**Contract** — frames exactly as SRS §5.4; ack by `id`.
**Tests** — `socket.test.ts › "sends auth within 5 seconds"`, `› "reconnects with backoff and jitter"`, `› "4401 refreshes once then expires session"`, `› "ack resolves send promise"`, `› "queues frames until open and flushes in order"`, `› "missing pong closes socket"`; `bridge.test.ts › "msg prepends and increments unread"`, `› "presence updates query"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run lib/realtime`.
**Done when** — a mock server sending `presence` flips the dot on Home without reload.

### T-WEB-32 · Buzz: send screen (2) and incoming overlay (6)
- **Closes:** FR-NUDGE-01..08, AC-15, AC-16 (web)
- **Depends on:** T-WEB-31, T-WEB-09; T-COMM (nudges), T-NOTIF (quiet hours)  · **Milestone:** M3 · **Layer:** web
**Why** — Remind someone with a vibration and a spoken phrase. Design: `Buzz.dc.html` (2), `Incoming.dc.html` (6).
**Files**
- C `apps/web/app/(app)/buzz/page.tsx`, `components/features/comms/{RecipientPicker.tsx,PhrasePicker.tsx,IntensityPicker.tsx,BuzzSendButton.tsx,IncomingBuzz.tsx,BuzzStateLine.tsx}`, `lib/comms/vibration.ts`
**Steps**
1. **Screen 2** (title "কম্পন পাঠান", sub "ফোন কাঁপবে, আওয়াজ ছাড়াই মনে করিয়ে দিন।"): "কাকে?" avatar row (multi-select, selected = ring + "✓ আম্মু"); "কী বলবেন?" 2-col grid of 72 px buttons from `GET /v1/nudge-phrases` (খেতে আসুন, ফোন করুন, বাড়ি আসুন, খরচ লিখুন, ওষুধ খান, শুধু ডাকছি, বাজেট শেষ) with icons; "কত জোরে?" three 56 px choices **আস্তে · / মাঝারি ·· / জোরে ···**; sticky amber button "আম্মুকে কম্পন পাঠান" (72 px) and helper "আম্মুর ফোনে "খেতে আসুন" লেখা দেখাবে এবং ফোন কাঁপবে।". Query params `to`, `phrase` preselect.
2. Send `POST /v1/families/:id/nudges {recipientIds, phraseId, intensity}`; errors: `nudge_rate_limited` → "একটু পরে আবার পাঠান।"; quiet hours info from recipient preference → before sending show "চুপ সময়, পরে দেখবেন" (from `GET …/members` `quiet: true`).
3. `BuzzStateLine` under the sender's chat card: sent → "পাঠানো হয়েছে", delivered → "পৌঁছেছে", seen → "দেখেছে", replied → "আসছি" etc. from `nudge.state` events.
4. **Screen 6 `IncomingBuzz`** (full-screen `<dialog role="alertdialog">` on `nudge` events): amber `#F2A33A` background; 128 px sender avatar with two concentric rings (CSS animation, disabled when `prefers-reduced-motion`); "আব্বু আপনাকে কম্পন দিয়েছেন" 18 px; phrase 44 px 700; white pill "“খেতে আসুন” বলা হচ্ছে" with speaker icon; buttons "আসছি" (green 80 px), "পরে বলছি" and "ফোন করি" (outline 64 px). Actions → `POST /v1/nudges/:id/reply {reply:"coming"|"later"|"call"}`; "ফোন করি" starts a call (`/call/new?to=`). Sends `seen` on open.
5. `vibration.ts`: `vibrate(intensity)` using `navigator.vibrate` with patterns soft `[200]`, medium `[300,150,300]`, strong `[500,200,500,200,500]` (feature-detected; silently no-op on desktop and iOS); phrase is spoken with `useSpeak` unless the user's quiet hours are active (checked locally from preferences).
6. When the tab is hidden and notification permission is granted, show a `Notification` with `vibrate` pattern and `requireInteraction: true` (web push does the same when closed, T-WEB-36).
**Tests** — `PhrasePicker.test.tsx › "seven phrases from the catalogue"`, `BuzzSendButton.test.tsx › "label follows selected recipient"`, `IncomingBuzz.test.tsx › "vibrates medium pattern and speaks phrase"` (AC-15), `› "quiet hours suppress vibration and speech"` (AC-16), `› "reply coming posts reply"`, `› "no animation with reduced motion"`, `vibration.test.ts › "patterns match SRS"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/comms lib/comms`.
**Done when** — a mock `nudge` frame opens the overlay and "আসছি" sends the reply.

### T-WEB-33 · Chat: conversation list (F1) and thread
- **Closes:** FR-CHAT-01..08, FR-NUDGE-07, AC-18, AC-19 (UI)
- **Depends on:** T-WEB-31; T-COMM (conversations, messages)  · **Milestone:** M3 · **Layer:** web
**Why** — The কথা tab. Design: `ChatList.dc.html` (F1), `Chat.dc.html` (3).
**Files**
- C `apps/web/app/(app)/chat/page.tsx`, `app/(app)/chat/[conversationId]/page.tsx`, `components/features/chat/{ConversationRow.tsx,MessageBubble.tsx,SystemCard.tsx,Composer.tsx,ReceiptTicks.tsx,TypingLine.tsx}`, `lib/chat/outbox.ts`, `lib/api/hooks/useMessages.ts`
**Steps**
1. **F1**: title "কথা"; two top buttons "কম্পন" and "ভিডিও"; rows (min 72 px): 52 px avatar, name, preview with type icon (text / "ভয়েস · ০:১২" / "ভিডিও · ০:২৪" / "কম্পন: খেতে আসুন" / "খরচ: বিদ্যুৎ বিল ৳ ২,৩৪০"), right time ("সন্ধ্যা ৬:০৫", "গতকাল") and a red unread badge with `aria-label="২টি নতুন"`; group "সবাই" first. Data: `GET …/conversations`.
2. **Thread** header: back, name, members line, video button (`aria-label="ভিডিও কল"`). Bubbles: others white with avatar and name colour, mine green white-text right; metadata "সন্ধ্যা ৬:০৫ · পৌঁছেছে ✓✓" (words "পৌঁছেছে"/"পড়েছে" via `ReceiptTicks`); date divider "আজ"; **system cards** (centred pills): buzz (amber) "আব্বু আম্মুকে কম্পন দিয়েছেন: খেতে আসুন", expense (green-100) "আম্মু খরচ লিখেছেন: বাজার ৳ ৮৫০" (taps to `/txn/:id`), call missed/ended.
3. `Composer`: amber buzz button (56 px, opens `/buzz?to=`), text field "এখানে লিখুন…" (max 2,000 chars), 64 px green mic button (→ `/voice-note?cid=`), send button appears when text present. Each message gets a client UUIDv7 `id`.
4. Sending: optimistic append with status "পাঠানো হচ্ছে"; `POST /v1/conversations/:id/messages {id, body}`; on offline/error keep in IndexedDB `outbox.messages` (`lib/chat/outbox.ts`, FIFO per conversation), retry in order on `online` and when the socket reopens; failed after 5 tries → "পাঠানো যায়নি · আবার চেষ্টা".
5. Read receipts: when the thread is visible and the last message is from another user, `POST /v1/conversations/:id/read {upTo}` (debounced 500 ms). Typing: `typing` frame at most every 3 s while composing; `TypingLine` "আম্মু লিখছেন…" (hidden if presence hidden).
6. Delete own message within 24 h ("মুছুন" in a long-press/menu → `DELETE /v1/messages/:id`), tombstone "মুছে ফেলা হয়েছে"; "শুনুন" (speaker) on text messages; Simple mode auto-speaks incoming text.
7. Pagination: `useInfiniteQuery` newest first, 50 per page, "আগের কথা দেখুন" on scroll-top; keep last 500 in memory.
**Tests** — `ConversationRow.test.tsx › "unread badge Bangla aria-label"`, `MessageBubble.test.tsx › "own bubble right with receipt words"`, `SystemCard.test.tsx › "expense card links to transaction"`, `outbox.test.ts › "same client id is not duplicated"` (AC-18), `› "flushes in order after reconnect"`, `useMessages.test.ts › "remote msg appends once"`, `chat.page.test.tsx › "private expense creates no card"` (server decides; test asserts UI renders whatever cards arrive).
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/chat lib/chat`.
**Done when** — two mock clients exchange messages with receipts and offline queue behaviour.

### T-WEB-34 · Voice notes and video messages (record, upload, play)
- **Closes:** FR-VNOTE-01..04, FR-VMSG-01, AC-20, AC-21 (UI)
- **Depends on:** T-WEB-33; T-COMM (media endpoints), T-PLAT (object storage + CORS for presigned PUT)  · **Milestone:** M3 (voice), M6 (video) · **Layer:** web
**Why** — Send a spoken message. Design: `VoiceNote.dc.html` (4), `Chat.dc.html` voice and video bubbles.
**Files**
- C `apps/web/app/(app)/voice-note/page.tsx`, `components/features/chat/{VoiceRecorder.tsx,Waveform.tsx,VoicePlayer.tsx,VideoRecorder.tsx,VideoBubble.tsx,MediaConsentNotice.tsx}`
- C `apps/web/lib/media/{recorder.ts,upload.ts,mime.ts,useMediaPlayer.ts}`
**Steps**
1. `mime.ts`: `pickAudioMime()` order `audio/mp4;codecs=mp4a.40.2`, `audio/webm;codecs=opus`, `audio/webm`; `pickVideoMime()` `video/mp4`, `video/webm;codecs=vp8,opus`. See §0.5 note about server acceptance.
2. `recorder.ts` wraps `MediaRecorder` (audio bitrate 32 kbps, `audioBitsPerSecond: 32000`; video 600 kbps at 640×360, 30 s cap); auto-stops at 60 s (audio) / 30 s (video); exposes elapsed ms and an `AnalyserNode` level stream for `Waveform` (bars as divs, 15 bars).
3. **Screen 4**: title "ভয়েস পাঠান", sub "সবাইকে পাঠানো হবে · সর্বোচ্চ ১ মিনিট"; card with red dot + "রেকর্ড হচ্ছে", timer 56 px "০:১২", waveform, hint "ফোনের কাছে মুখ রেখে বলুন"; info "পাঠানোর আগে একবার শুনে নিতে পারবেন।"; bottom: round "বাদ" (96 px, red outline) and "থামুন, শুনুন" (green 96 px). After stop: preview with `<audio controls>` plus buttons "আবার করুন" and "পাঠান".
4. Permission: before `getUserMedia`, show Bangla explanation ("মাইক চালু করতে দিন, নইলে রেকর্ড হবে না।"); denial → card with steps; no crash.
5. `MediaConsentNotice` (first use, FR-VNOTE-04): "ভয়েস মেসেজ আমাদের সার্ভারে থাকবে, ১৮০ দিন পর মুছে যাবে।" with button "বুঝেছি"; acceptance saved via `POST /v1/me/consents {kind:"voice_notes", version}` and remembered in the session.
6. Upload (`upload.ts`): client checks duration ≤ 60 s (video ≤ 30 s) and size ≤ 600 KB (video ≤ 8 MB) → shows "অনেক বড়, ছোট করে রেকর্ড করুন।" before calling the API (AC-21); `POST /v1/conversations/:id/voice-notes {durationMs, bytes, mime}` → `{mediaId, uploadUrl}`; `PUT uploadUrl` with the blob (progress via `XMLHttpRequest`); `POST /v1/voice-notes/:mediaId/confirm`. Retry the PUT up to 3 times; offline → keep blob in IndexedDB `outbox.media` and show "পাঠানো হচ্ছে".
7. `VoicePlayer` bubble: 52 px green play button, waveform thumbnail, "দাদির ভয়েস · ০:১৮", speed toggle 1×/1.5×; fetches `GET /v1/media/:id` signed URL on first play (URL cached ≤ 4 min), seeks by clicking the bar; one player at a time. `VideoBubble`: 190×124 poster with play icon and "তানভীরের ভিডিও · ০:২৪"; opens a full-screen `<video controls playsinline>`.
**Tests** — `mime.test.ts › "prefers mp4 then webm opus"`, `recorder.test.ts › "stops at 60 seconds"`, `upload.test.ts › "rejects over 600 KB before requesting upload"` (AC-21), `› "uploads then confirms in order"` (AC-20), `› "retries put 3 times"`, `VoicePlayer.test.tsx › "refetches signed url after expiry"`, `MediaConsentNotice.test.tsx › "shown once"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run components/features/chat lib/media`.
**Done when** — mock record (fake `MediaRecorder`) → upload → bubble with playable URL.

### T-WEB-35 · Video call in the browser (WebRTC)
- **Closes:** FR-VIDEO-01..09 (web), NFR-18, AC-32, AC-34 (web)
- **Depends on:** T-WEB-31, T-WEB-34; T-COMM (signalling, `GET /v1/rtc/ice`)  · **Milestone:** M6 · **Layer:** web
**Why** — Family can call from a laptop too. Design: `VideoCall.dc.html` (5), `Incoming.dc.html` for ringing.
**Files**
- C `apps/web/app/(app)/call/[callId]/page.tsx`, `components/features/call/{CallScreen.tsx,ParticipantTile.tsx,CallControls.tsx,QualityLabel.tsx,IncomingCall.tsx,PermissionHelp.tsx}`
- C `apps/web/lib/rtc/{PeerMesh.ts,signalling.ts,stats.ts,ice.ts,useCall.ts}`
**Steps**
1. `ice.ts`: `GET /v1/rtc/ice` → `RTCConfiguration.iceServers`; refetch if `expiresAt` < 5 min away.
2. `signalling.ts`: typed wrappers over `useRealtime().send` for `call.invite/accept/reject/offer/answer/ice/end`.
3. `PeerMesh` manages one `RTCPeerConnection` per remote user (max 4 total): caller creates offers (perfect-negotiation pattern with polite/impolite roles by user id order), ICE candidates trickled, `ontrack` → tile stream; `close()` on `call.end`.
4. `stats.ts`: sample `getStats()` every 2 s → packet loss %, RTT, bitrate; **adaptation** (FR-VIDEO-06, SRS §8.5): start 640×360 / 15 fps / `maxBitrate 400_000`; at loss > 8% scale to 240p; at loss > 15% for 5 s stop sending video (`sender.replaceTrack(null)`), label "শুধু কথা চলছে"; recover after 10 s of loss < 5%.
5. `CallScreen` (dark `#14110D`): header name 24 px, location/time "রিয়াদ · ০৫:২৩", quality pill (ভালো green + check / দুর্বল amber + warning / নেই red + cross — word and icon); 430 px remote tile (initial avatar when video off) with 96×128 self view; joiner chips "আম্মু যোগ দিয়েছেন", "দাদি আসছেন…"; controls: mic (72 px), **end call** (88 px red, "শেষ করুন"), camera (72 px), each with a label under it.
6. `IncomingCall` overlay on `call.invite`: full-screen, 45 s ring with vibration pattern `[500,300]` repeating via `navigator.vibrate` and a ring sound (`public/sounds/ring.mp3`), big "ধরুন" / "রাখুন" buttons; timeout → "মিস কল".
7. `PermissionHelp`: Bangla steps when camera/mic denied; offers "শুধু কথা বলি" audio-only.
8. Busy → "ব্যস্ত আছেন" with a "কম্পন দিন" button; call ends write a chat card via the server.
**Tests** — `PeerMesh.test.ts › "perfect negotiation resolves glare"`, `› "limits to 4 participants"`; `stats.test.ts › "loss over 15% for 5s switches to audio-only"` (AC-34), `› "recovers after 10s under 5%"`; `ice.test.ts › "refetches before expiry"`; `CallControls.test.tsx › "end button is 88px with label"`; `IncomingCall.test.tsx › "rings for 45 seconds then marks missed"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run lib/rtc components/features/call`.
**Done when** — two Playwright contexts with fake media (`--use-fake-device-for-media-stream`) exchange tracks (spec in T-WEB-39).

### T-WEB-36 · Web push (service worker + FCM web token)
- **Closes:** FR-NOT-01, FR-NOTIF-06, -07, FR-AUTH-11 (web), FR-NUDGE-08 (web)
- **Depends on:** T-WEB-08, T-WEB-32; T-NOTIF (device registry), T-PLAT (fake FCM)  · **Milestone:** M3 · **Layer:** web
**Why** — Buzz and calls must reach a closed tab.
**Files**
- C `apps/web/lib/push/{register.ts,messaging.ts,permission.ts}`, `public/firebase-messaging-sw.js`, `components/features/notifications/PushPrompt.tsx`
**Steps**
1. `PushPrompt` (card on Home after the first successful action, dismissible for 14 days): "খবর পেতে অনুমতি দিন" with button "অনুমতি দিন"; explains what will be sent.
2. `messaging.ts`: initialise Firebase app from `NEXT_PUBLIC_FIREBASE_*`, `getToken(messaging, {vapidKey, serviceWorkerRegistration})`; register token via `PUT /v1/me/devices/:deviceId {platform:"web", fcmToken, appVersion, locale}`; re-register on `onTokenRefresh`-equivalent (check once per day) and `DELETE` on logout.
3. `firebase-messaging-sw.js`: `onBackgroundMessage` for **data** messages: `type:"nudge"` → `showNotification(title=phrase, {body: "আব্বু আপনাকে কম্পন দিয়েছেন", vibrate: pattern, requireInteraction:true, tag:nudgeId, data:{url:"/buzz?nudge="+id}, actions:[{action:"coming",title:"আসছি"}]})`; `type:"call"` → ringing notification with `requireInteraction` and actions "ধরুন"/"রাখুন"; `type:"msg"` → notification with truncated body; `type:"inbox"` generic. `notificationclick` focuses an existing client or opens the URL; action buttons call the API via `fetch` with the cookie.
4. When a client tab is focused the SW does not show notifications (it posts the data to the page instead).
5. Config absent (no keys) → feature hidden silently.
**Tests** — `messaging.test.ts › "registers token with web platform"`, `› "skips when keys missing"`; `permission.test.ts › "denied is remembered"`; service worker logic in `public/firebase-messaging-sw.test.ts` (Vitest with a fake `self`): `› "nudge shows persistent vibrating notification"`, `› "focused client suppresses notification"`.
**Acceptance** — `pnpm --filter @amar-poribar/web test --run lib/push public`.
**Done when** — fake FCM sink receives the device registration and a posted data message triggers the SW test path.

### T-WEB-37 · Playwright infrastructure
- **Closes:** GAP-WEB-04, NFR-10, NFR-24 (infra)
- **Depends on:** T-WEB-01, T-WEB-04; T-PLAT (compose with fakes, `tools/fixtures`)  · **Milestone:** M2 · **Layer:** web
**Why** — One place to run browser tests against mocks or the real stack.
**Files**
- C `apps/web/e2e/playwright.config.ts`, `e2e/fixtures/{test.ts,stack.ts,auth.ts,realtime.ts}`, `e2e/helpers/{a11y.ts,visual.ts,fakeSpeech.ts,fakeMedia.ts}`
- M `apps/web/package.json` scripts `e2e` (`playwright test -c e2e/playwright.config.ts`), `e2e:mock` (`AP_MOCK=1 … --grep @mock`), `e2e:snapshots:update`
**Steps**
1. Config: projects `mobile` (`devices["Pixel 7"]` overridden to 390×844, locale `bn-BD`, timezone `Asia/Dhaka`) and `desktop-web` (1280×800); `use: {baseURL, trace:"on-first-retry", video:"retain-on-failure"}`; `webServer` runs `pnpm --filter @amar-poribar/web start` (after `build`) with `AP_MOCK=1` for the mock project; `retries: process.env.CI ? 1 : 0`; `expect.toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" }`.
2. `stack.ts`: for the real stack, `waitForStack()` polls `http://localhost:4000/ready` and `http://localhost:3000`; imports `tools/fixtures` (`createUser`, `createFamily`, `addMember`, `seedTransactions`, `seedBudgets`).
3. `auth.ts`: `loginAs(context, user)` performs OTP request/verify through the BFF using the fake SMS gateway's `GET /__fake/sms/last?phone=` so cookies land in the context; `storageState` cached per user.
4. `a11y.ts`: `checkA11y(page)` runs `@axe-core/playwright` with rules `wcag2a, wcag2aa, wcag21aa` and fails on any violation except an allow-list file `e2e/a11y-allow.json` (must be empty at the end of the milestone).
5. `visual.ts`: `snap(page, name)` waits for fonts and network idle, hides caret/time-varying text (`[data-testid=now]`), then `expect(page).toHaveScreenshot(`${name}.png`)`.
6. `fakeSpeech.ts`: injects a fake `SpeechRecognition` (scripted transcripts) and records `speechSynthesis.speak` calls into `window.__spoken`; `fakeMedia.ts` provides `getUserMedia`/`MediaRecorder` stubs for non-WebRTC specs.
7. Add `.github/workflows` job `web-e2e` wiring is in T-WEB-41.
**Tests** — `e2e/flows/smoke.spec.ts › "home loads in mock mode and passes axe"` (tag `@mock`).
**Acceptance** — `pnpm --filter @amar-poribar/web build && pnpm --filter @amar-poribar/web e2e:mock`.
**Done when** — smoke spec passes in both viewports.

### T-WEB-38 · Playwright flows AC-01..AC-14 (web subset)
- **Closes:** AC-01..AC-14 (UI parts), FR-A11Y, AC-06
- **Depends on:** T-WEB-10..T-WEB-24, T-WEB-37; backend M2 tasks for the real-stack variants  · **Milestone:** M2 · **Layer:** web
**Why** — Executable acceptance of the MVP in the browser.
**Files** — C `apps/web/e2e/flows/ac-*.spec.ts` (one per AC) using fixtures from T-WEB-37.
**Steps** — implement exactly these specs (each runs in `@mock` and `@stack` variants where noted; `@stack` needs the Compose stack):
1. `ac-01-shared-total.spec.ts › "two members see the same month total within 5 seconds"` `@stack`: two contexts (Shathi, Rahim) each add an expense via manual form; both reload Home and assert the same `৳` total within 5 s.
2. `ac-02-voice-draft.spec.ts › "bazar 850 cash becomes a ৳ ৮৫০ draft"`: fake recognition says "আজ বাজারে ৮৫০ টাকা দিলাম ক্যাশে"; assert read-back card shows বাজার ও মুদি, ৳ ৮৫০, ক্যাশ; `window.__spoken` contains the sentence; ✓ saves.
3. `ac-03-04-sms.spec.ts › "sms parses without AI"` and `› "pasting twice shows already-recorded banner"` `@stack` (assert AI call counter via `GET /__fake/claude/calls` = 0 for the first).
4. `ac-05-budget-alert.spec.ts › "80 percent budget strip appears"`: seed ৳10,000 bazar budget and ৳8,100 spend; Home shows the amber strip with "আম্মুকে জানান".
5. `ac-06-i18n.spec.ts › "every tab screen switches language"`: visit all routes from §0.2 in bn then en; assert no text matches `/[ঀ-৿]/` in en mode except user data and names (allow-list), and no `missing key` marker.
6. `ac-07-permissions.spec.ts › "member cannot edit another member's transaction"` (UI shows the Bangla message) and `› "foreign family id returns not found page"`.
7. `ac-09-picker.spec.ts › "পাঁচশো টাকা দিলাম opens the picker"`.
8. `ac-10-summary.spec.ts › "screen shows ৳ and Listen speaks words"`.
9. `ac-12-otp.spec.ts › "sixth wrong code shows A7"` and `› "sixth code request shows rate limit"` `@stack`.
10. `ac-13-session.spec.ts › "expired refresh shows F6 and returns to the same screen"`: expire cookies server-side via fake clock endpoint, call an action, land on `/session-expired?next=/list`, log in, end on `/list`.
11. `ac-14-list.spec.ts › "120 rows load in 3 pages and undo delete works"`.
12. Every spec ends with `await checkA11y(page)`.
**Tests** — the specs above are the tests.
**Acceptance** — `pnpm --filter @amar-poribar/web e2e:mock` (mock specs) and `pnpm --filter @amar-poribar/web e2e --grep @stack` against `docker compose up -d` (stack specs).
**Done when** — both commands exit 0 on a clean checkout.

### T-WEB-39 · Playwright flows for communication (AC-15, 16, 18, 19, 20, 22, 32 web subset)
- **Closes:** AC-15, AC-16, AC-18, AC-19, AC-20, AC-22, AC-32 (web)
- **Depends on:** T-WEB-31..T-WEB-35, T-WEB-37; T-COMM  · **Milestone:** M3/M6 · **Layer:** web
**Files** — C `apps/web/e2e/flows/comms-*.spec.ts`, `apps/web/e2e/helpers/twoUsers.ts`
**Steps**
1. `comms-buzz.spec.ts › "buzz is delivered in 2 seconds and state reaches replied"` (AC-15): sender context opens `/buzz`, picks আম্মু + "খেতে আসুন" + মাঝারি; recipient page receives overlay within 2 s (assert elapsed), `window.__vibrations` equals `[300,150,300]`, taps "আসছি"; sender chat shows "আসছি". `› "fourth buzz in a minute shows the wait message"` (AC-16). `› "quiet hours suppress vibration"`.
2. `comms-chat.spec.ts › "same client id twice stores one message"` (AC-18, via two rapid retries with network blocked then restored), `› "offline messages send in order"`, `› "expense card appears for non-private expense only"` (AC-19).
3. `comms-voice-note.spec.ts › "record, upload to MinIO, play for member, not for outsider"` (AC-20) using `fakeMedia` and the real stack; `› "over 60 seconds is blocked before upload"`.
4. `comms-presence.spec.ts › "online dot and word flip within 3 seconds, hidden when opted out"` (AC-22).
5. `comms-call.spec.ts › "two contexts complete a call over fake TURN"` (AC-32) launching Chromium with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`; asserts both tiles have `videoWidth > 0` and that invalid TURN credentials (env `FAKE_TURN_BAD=1`) end with the "সংযোগ হয়নি" state.
6. Each spec calls `checkA11y`.
**Acceptance** — `pnpm --filter @amar-poribar/web e2e --grep "comms-"` against Compose.
**Done when** — all specs pass; elapsed-time assertions use server timestamps, not sleeps.

### T-WEB-40 · Visual and design-conformance specs
- **Closes:** NFR-24, FR-A11Y-01..03
- **Depends on:** T-WEB-10..T-WEB-36, T-WEB-37  · **Milestone:** M4 · **Layer:** web
**Why** — Catch drift from the design without a person looking: screenshots within 2% and measurable rules.
**Files**
- C `apps/web/e2e/visual/screens.spec.ts`, `e2e/visual/conformance.spec.ts`, `e2e/__screenshots__/**` (committed baselines)
- C `apps/web/scripts/snapshots-docker.sh` (runs Playwright in `mcr.microsoft.com/playwright:v1.49.1-noble` so baselines are stable)
**Steps**
1. `screens.spec.ts`: table of `[route, name, setup]` for every W-screen in SRS §5.1.3 (≈ 38 routes) at 390×844 in mock mode with fixed data and frozen clock (`page.clock.setFixedTime("2026-11-11T17:10:00+06:00")`); `await snap(page, name)` with `maxDiffPixelRatio 0.02`; also dark theme variants for Home, B1, B3.
2. `conformance.spec.ts` asserts per screen from the design: every `button, a[role=button], input, select` has bounding box ≥ 48×48 (primary action ≥ 56 px high; Simple mode ≥ 72); no horizontal scroll (`scrollWidth ≤ innerWidth`); computed colours of tokens (`--green-700` etc.) equal the design values; required copy strings exist (a table `screen → [strings]` taken from the tasks above, e.g. A1 "আপনার মোবাইল নম্বর দিন", A2 "আমি রাজি আছি", B3 "বাজেট শেষ"); status elements contain icon + word (`[data-status]` has `svg` and text).
3. `snapshots-docker.sh` generates baselines: `docker run --rm -v $PWD:/work -w /work/apps/web mcr.microsoft.com/playwright:v1.49.1-noble pnpm e2e:snapshots:update`. The task commits the produced PNGs (no human review step; CI compares).
**Tests** — the two specs.
**Acceptance** — `pnpm --filter @amar-poribar/web e2e:mock --grep "@visual|@conformance"`.
**Done when** — all screens pass both specs and the conformance table covers every W-screen in §5.1.3 (a unit test `conformance.coverage.test.ts` compares the table to the screen catalogue).

### T-WEB-41 · CI wiring for web and admin; `verify` scripts
- **Closes:** GAP-ARCH-10 (web/admin), NFR-11, NFR-20
- **Depends on:** T-WEB-37, T-ADMUI-14, T-PLAT (CI baseline)  · **Milestone:** M2 (web), M5 (admin) · **Layer:** platform
**Why** — The only gate is CI (README rule 1).
**Files**
- M `.github/workflows/ci.yml` (jobs `web` and `admin`), M root `package.json` (`verify:web`, `verify:admin` added to `verify:m2` and `verify:m5`)
- M `apps/web/Dockerfile` stage if missing (the root `Dockerfile` already has `web`; add `admin` target)
**Steps**
1. Job `web`: checkout → pnpm install (cache) → `pnpm --filter @amar-poribar/web gen:api:check lint typecheck test -- --coverage` → `build` → `playwright install --with-deps chromium` → `e2e:mock`.
2. Job `web-stack` (needs Compose): `docker compose up -d --wait` → `pnpm --filter @amar-poribar/web e2e --grep "@stack|comms-"` → logs on failure → `down -v`.
3. Job `admin` mirrors `web` with `apps/admin` and the ADM specs.
4. Cache Playwright browsers keyed by `@playwright/test` version; upload traces and screenshot diffs as artifacts on failure.
5. `verify:web` = `gen:api:check && lint && typecheck && test --run && build && e2e:mock`; `verify:admin` same for admin.
6. Coverage thresholds from T-WEB-01 enforced with `--coverage.thresholds`.
**Tests** — CI itself; add `scripts/check-ci-jobs.mjs` asserting both jobs exist in `ci.yml` (run in `pnpm test` of root).
**Acceptance** — `pnpm verify:web && pnpm verify:admin` locally; CI green on a pull request.
**Done when** — the workflow file contains `web`, `web-stack`, `admin` jobs and a PR run finishes in ≤ 20 minutes.

---

## 2. T-ADMUI tasks (admin console, `apps/admin`)

Common facts for all T-ADMUI tasks:
- English UI only (family names are Bangla data); font stack `Inter, "Hind Siliguri", system-ui` self-hosted with `next/font/local`.
- Design tokens (from `AdminOverview.dc.html` and siblings): page `#F6F1E7`, ink `#2A2118`, muted `#5A4B3B`, sidebar `#14451A` (items `#DDEBDD`, active item white background with `#14451A` bold text), cards white with `1px #E3D9C5` and radius 16 px, table header 13 px `#5A4B3B` 600, row text 15 px, row border `#EFE6D3`, primary button `#14451A`, inputs 44–48 px high with `1px #CDBFA5` and radius 10 px, status pills radius 12 px 13 px 600 (**always icon + word**: ✓ Active green-100 `#E6F2E3`/`#14451A`, ⚠ amber `#FDEBCB`/`#6B3F00`, ■ red `#F8D7D3`/`#8A1C14`, neutral `#F1E6D3`/`#4A3C2C`).
- Layout is a fluid PAGE: sidebar `flex: 0 0 232px`, main `flex: 999 1 560px; min-width: 0; padding: 28px 32px`; below 760 px the sidebar stacks on top; wide tables scroll horizontally in a box (`overflow-x: auto`, `min-width: 820px`).
- The console shows counts, plans and status only. Fields on the private list (`packages/shared/src/private-fields.ts`: `amountPaisa`, `note`, `counterparty`, `body`, `mediaId`, `phone`, `trxId`) never appear in any admin type; T-ADMUI-13 enforces this.
- API base is the BFF proxy `/api/proxy/admin/v1/...`; types are generated from `apps/api/openapi.json` (`/admin/v1` paths) into `apps/admin/lib/api/schema.d.ts`.
- Backend capabilities consumed: **T-ADM** (all `/admin/v1` routes, hash chain, TOTP), **T-PRIV** (privacy request steps), **T-BILL** (plans), **T-FAM** (suspension, ownership transfer), **T-PLAT** (health metrics). MSW handlers in `apps/admin/mocks` let every screen task run before they land.

### T-ADMUI-01 · Scaffold `apps/admin`
- **Closes:** GAP-ADMUI-01, DEC-12
- **Depends on:** T-WEB-01 (copy tooling), T-PLAT (workspace, compose)  · **Milestone:** M5 · **Layer:** admin
**Why** — A separate Next.js app keeps staff pages, cookies and dependencies away from the family web app.
**Files**
- C `apps/admin/{package.json,tsconfig.json,next.config.ts,eslint.config.mjs,vitest.config.ts,vitest.setup.ts,.env.example,next-env.d.ts}`
- C `apps/admin/app/{layout.tsx,globals.css,error.tsx,not-found.tsx}`, `apps/admin/styles/{tokens.css,base.css}`
- C `apps/admin/mocks/{handlers.ts,server.ts,fixtures.ts}`, `apps/admin/instrumentation.ts`
- M `pnpm-workspace.yaml` (already `apps/*`), `turbo.json` (no change if generic), `docker-compose.yml` (service `admin`, port `3100`, env `API_URL=http://api:4000`), `Dockerfile` (target `admin`: `pnpm --filter @amar-poribar/admin build` then `next start -p 3100`), `.env.example`
**Steps**
1. `package.json`: name `@amar-poribar/admin`, scripts `dev` (`next dev -p 3100`), `build`, `start` (`next start -p 3100`), `typecheck`, `lint`, `test`, `gen:api`, `gen:api:check`, `e2e`, `e2e:mock`; deps `next ^16.4.0`, `react ^19.3.0`, `react-dom ^19.3.0`, `@tanstack/react-query ^5.62.0`, `openapi-fetch ^0.13.0`, `zod ^4.1.0`, `react-hook-form ^7.54.0`, `@hookform/resolvers ^3.9.0`, `@amar-poribar/shared workspace:*`; dev deps identical to web (`vitest`, RTL, `msw`, `@playwright/test`, `@axe-core/playwright`, `openapi-typescript`, eslint stack).
2. Copy the web tooling files (T-WEB-01) and adapt: `vitest` setup without speech stubs; ESLint rule `no-restricted-imports` for `@amar-poribar/shared/private-fields` use in `components/**` (only allowed in tests).
3. `app/layout.tsx`: `<html lang="en">`, tokens, fonts, `Providers` (QueryClient).
4. Compose: `admin` service depends on `api` healthy; healthcheck `curl -f http://localhost:3100/login`.
5. `.env.example`: `API_URL`, `COOKIE_SECURE`, `AP_MOCK`.
**Contract** — port 3100; env as above.
**Tests** — `smoke.test.ts › "renders with jsdom"`.
**Acceptance** — `pnpm --filter @amar-poribar/admin lint typecheck test --run build`; `docker compose config --services | grep -x admin`.
**Done when** — `pnpm --filter @amar-poribar/admin dev` serves a placeholder on 3100 and the Compose stack lists `admin`.

### T-ADMUI-02 · Staff session BFF and proxy (httpOnly cookie, audience token)
- **Closes:** FR-ADM-01 (session), NFR-23, DEC-12
- **Depends on:** T-ADMUI-01; T-ADM (staff auth endpoints) or mocks  · **Milestone:** M5 · **Layer:** admin
**Why** — The staff token must never be readable by JavaScript and must never be usable on family routes.
**Files**
- C `apps/admin/lib/auth/{cookies.ts,csrf.ts,session.ts,idle.ts}`
- C `apps/admin/app/api/staff/login/route.ts`, `totp/route.ts`, `logout/route.ts`, `session/route.ts`
- C `apps/admin/app/api/proxy/[...path]/route.ts`, `apps/admin/middleware.ts`
**Steps**
1. Cookie `ap_staff`: httpOnly, Secure (not on localhost), **SameSite=Strict**, path `/`, Max-Age 1800 (30 min). Every successful proxy call re-issues it (sliding idle window). A second cookie `ap_staff_meta` (readable, no secrets) holds `{name, role, exp}` for UI.
2. `login/route.ts` posts `{email, password}` to `${API_URL}/admin/v1/auth/login` and passes through `{status, challengeId, otpauthUri?, secret?}` (`status` = `totp_required` | `totp_enroll`); errors passed through (`invalid_credentials`, `account_locked {retryAfterSeconds}`).
3. `totp/route.ts` posts `{challengeId, code}` to `…/auth/totp`; on 200 `{token, name, role}` set both cookies, return `{ok:true, role, name}` (token never in the body).
4. `logout/route.ts` calls `…/auth/logout` then clears cookies. `session/route.ts` returns `{authenticated, role, name, expiresAt}` from `GET /admin/v1/me`.
5. Proxy: only paths beginning `admin/v1/` are forwarded (anything else 404); adds `Authorization: Bearer <ap_staff>`; non-GET requires `x-ap-csrf: 1` and same `Origin`; on upstream 401 clears cookies and returns `401 {error:{code:"session_expired"}}`; sets `cache-control: no-store`; response bodies are passed through byte-for-byte.
6. `middleware.ts`: redirect to `/login?next=` when no `ap_staff`; matcher excludes `/login`, `/api/staff/*`, `/_next`, assets.
7. `idle.ts` (client): warn at 28 minutes idle with a dialog "Your session ends in 2 minutes" and a "Stay signed in" button that pings `/api/staff/session`; hard sign-out at 30 minutes; absolute 8 h limit is enforced by the API and surfaces as `session_expired`.
**Tests** — `cookies.test.ts › "SameSite=Strict, httpOnly, Max-Age 1800"`; `proxy/route.test.ts › "forwards only admin/v1"`, `› "re-issues cookie on success"`, `› "clears cookie and 401 on upstream 401"`, `› "rejects POST without csrf header"`; `login/route.test.ts › "never returns a token"`; `idle.test.ts › "warns at 28 minutes"`.
**Acceptance** — `pnpm --filter @amar-poribar/admin test --run lib/auth app/api`; `grep -R "localStorage\|sessionStorage" apps/admin/app apps/admin/lib apps/admin/components | wc -l` prints `0`.
**Done when** — mock staff can sign in and `document.cookie` shows no `ap_staff`.

### T-ADMUI-03 · C0 Staff sign-in with TOTP, lockout UX and TOTP enrolment
- **Closes:** FR-ADM-01, AC-29 (UI)
- **Depends on:** T-ADMUI-02  · **Milestone:** M5 · **Layer:** admin
**Why** — Secure entry for staff. Design: `AdminLogin.dc.html`.
**Files**
- C `apps/admin/app/(public)/login/page.tsx`, `components/auth/{SignInForm.tsx,TotpInput.tsx,EnrollTotp.tsx,LockoutNotice.tsx}`, `lib/auth/qr.ts`
**Steps**
1. Two-panel layout: left green panel (`#14451A`) with "আমার পরিবার", "Admin console", and "Staff tools for families, plans and privacy requests. Family data stays private."; right card (max 400 px): title "Staff sign-in", sub "Only for Amar Poribar staff. Family members sign in on the app."; fields **Work email**, **Password** (with "Show" toggle, `aria-pressed`), **6-digit code from your authenticator app** (6 boxes, paste support); primary button "Sign in" (50 px, `#14451A`); links "Forgot password?" and "Lost your device?" (both show an info dialog: "Ask a Staff Owner to reset it. Every reset is written to the audit log."); amber notice "5 wrong tries lock the account for 15 minutes. Every sign-in is recorded in the audit log."
2. Flow: submit email+password → if `totp_required` the code boxes enable; submit code → session → `router.replace(next ?? "/")`. The design shows all three fields at once; implement it as one form that submits credentials first and enables the code row, keeping all fields visible.
3. `totp_enroll` (first sign-in): replace the code row with `EnrollTotp`: QR drawn from `otpauthUri` using a tiny dependency-free QR generator (`lib/auth/qr.ts` renders to `<canvas>`; library `qrcode ^1.5.4` is acceptable instead), the secret in groups of 4 characters with a "Copy" button, and a code field to confirm.
4. Errors: `invalid_credentials` → "Email or password is not correct." (never says which); `totp_invalid` → "That code is not correct. Try the next code." with attempts left; `account_locked` → `LockoutNotice` with a live countdown from `retryAfterSeconds` ("Try again in 14:32") and the form disabled; `totp_expired` → "Code expired. Enter the newest code."
5. Focus management: first invalid field receives focus; all errors in `role="alert"`.
**Contract** — `POST /api/staff/login {email, password}` → `{status:"totp_required"|"totp_enroll", challengeId, otpauthUri?, secret?}` | 401 `invalid_credentials` | 423 `account_locked {retryAfterSeconds}`; `POST /api/staff/totp {challengeId, code}` → `{ok, role, name}` | 401 `totp_invalid {attemptsLeft}`.
**Tests** — `SignInForm.test.tsx › "code row enabled after credentials accepted"`, `› "generic message for bad credentials"`; `LockoutNotice.test.tsx › "counts down and re-enables form"` (AC-29); `EnrollTotp.test.tsx › "shows secret in groups of four and confirms with code"`; `TotpInput.test.tsx › "paste fills six boxes"`.
**Acceptance** — `pnpm --filter @amar-poribar/admin test --run components/auth`.
**Done when** — mock sign-in with email+password+`123456` reaches the overview; five wrong codes show the lockout.

### T-ADMUI-04 · Console layout, navigation and shared UI kit
- **Closes:** FR-ADM-09 (role-aware nav), NFR-10, NFR-23
- **Depends on:** T-ADMUI-02  · **Milestone:** M5 · **Layer:** admin
**Why** — Every console page shares the sidebar and the same table, pill and dialog components.
**Files**
- C `apps/admin/app/(console)/layout.tsx`, `components/shell/{Sidebar.tsx,PageTitle.tsx,SessionBar.tsx}`, `lib/auth/useStaff.ts`
- C `apps/admin/components/ui/{DataTable.tsx,Pagination.tsx,FilterBar.tsx,SelectField.tsx,TextField.tsx,Kpi.tsx,StatusPill.tsx,Card.tsx,Button.tsx,ReasonDialog.tsx,TypedConfirmDialog.tsx,Toast.tsx,Countdown.tsx,CopyButton.tsx,EmptyState.tsx}` each with a test
- C `apps/admin/lib/api/{client.ts,errors.ts,queryKeys.ts}`, `lib/permissions.ts`
**Steps**
1. `Sidebar` items in order: **Overview** (`/`), **Families** (`/families`), **Privacy requests** (`/privacy`, amber count badge from `GET /admin/v1/overview` `openPrivacyRequests`), **Plans & AI quota** (`/plans`), **Audit log** (`/audit`), **Staff accounts** (`/staff`), **System health** (`/health`); active item = white background, `#14451A` bold; each is a real `<a>` with `aria-current="page"`. Header block "আমার পরিবার" 18 px / "Admin console" 12 px.
2. `SessionBar` (top of main on narrow screens): staff name, role chip, "Sign out" button.
3. `lib/permissions.ts` encodes the matrix of `AdminStaff.dc.html`: Owner = all; Support = view, change plan/quota, handle privacy requests, transfer ownership; Read-only = view only; helpers `can(role, "suspend")`. `useStaff()` reads `/api/staff/session` once.
4. `DataTable<T>`: columns config (`header`, `cell`, `sortable`, `align`), header `<th scope="col">` with `aria-sort`, sticky header, horizontally scrollable container, row hover, keyboard-focusable row action links; loading skeleton and `EmptyState`.
5. `StatusPill({kind, children})` always renders icon + text: `ok` (✓), `warn` (⚠), `risk` (■), `neutral` (no icon, text only), `info` (ⓘ).
6. `ReasonDialog`: textarea "Reason (required, at least 10 characters)" with live counter; `onConfirm(reason)`; disabled until valid. `TypedConfirmDialog` extends it with "Type the family name to confirm" and compares exactly (Unicode NFC) before enabling the red button.
7. `client.ts` as in T-WEB-04 (`openapi-fetch`, baseUrl `/api/proxy/`, csrf header), `ApiProblem`, on `session_expired` redirect to `/login?next=`.
**Tests** — `Sidebar.test.tsx › "seven items in order and aria-current"`; `permissions.test.ts › "support cannot suspend"`, `› "read-only has no actions"`; `DataTable.test.tsx › "aria-sort toggles"`, `› "scroll container for wide tables"`; `ReasonDialog.test.tsx › "needs 10 characters"`; `TypedConfirmDialog.test.tsx › "exact Bangla name required"`; `StatusPill.test.tsx › "always has text and an icon for ok/warn/risk"`.
**Acceptance** — `pnpm --filter @amar-poribar/admin test --run components lib`.
**Done when** — the placeholder Overview renders inside the shell and the sidebar stacks above content at 600 px width.

### T-ADMUI-05 · C1 Overview
- **Closes:** FR-ADM-02, NFR-13
- **Depends on:** T-ADMUI-04; T-ADM (`GET /admin/v1/overview`)  · **Milestone:** M5 · **Layer:** admin
**Why** — The owner's daily glance. Design: `AdminOverview.dc.html`.
**Files** — C `apps/admin/app/(console)/page.tsx`, `components/overview/{KpiRow.tsx,NeedsAttention.tsx,NewFamiliesChart.tsx,PrivacyNote.tsx}`
**Steps**
1. Title "Overview" and right-aligned "Last 30 days · data as of {time} (Asia/Dhaka)".
2. `KpiRow` (auto-fit grid, min 200 px): **Active families** (value + "+86 vs previous 30 days"), **Avg. members per family** ("Goal: 2.5 or more (met)"), **AI cost per active family** ("৳ 11.4", "Goal: ৳ 15 or less (met)"), **Open privacy requests** ("Oldest: 12 days of 30", amber text when ≥ 10 days). "Met/Not met" is text plus ✓/⚠.
3. `NeedsAttention` card with rows (title, detail, link): "7 families used 90%+ of AI quota" → `/families?quota=over90`; "OTP delivery failures: 4.2% today" → `/health`; "2 families have no active owner" → `/families?status=no_owner`.
4. `NewFamiliesChart`: 8 weekly CSS bars (heights from data), last week dark green, caption "This week: 92 new"; includes a visually hidden table.
5. `PrivacyNote` (green-100 card, lock icon): "Privacy by design: this console shows counts, plans and status only. Staff cannot see a family's transactions, notes, chat, voice notes or video."
**Contract** — `GET /admin/v1/overview` → `{ activeFamilies, activeFamiliesDelta, avgMembers, aiCostPerFamilyPaisa, openPrivacyRequests, oldestPrivacyRequestDays, needsAttention:[{kind,count,detail,href}], newFamiliesByWeek:[{weekStart,count}], asOf }`.
**Tests** — `KpiRow.test.tsx › "goal met shows check and word"`, `› "oldest request ≥ 10 days is amber"`; `NeedsAttention.test.tsx › "links carry filters"`; `NewFamiliesChart.test.tsx › "bar heights scale and table exists"`.
**Acceptance** — `pnpm --filter @amar-poribar/admin test --run components/overview`.
**Done when** — fixture data reproduces the design numbers.

### T-ADMUI-06 · C2 Families list with search, filters, pagination, export
- **Closes:** FR-ADM-03, FR-ADM-11
- **Depends on:** T-ADMUI-04; T-ADM (`GET /admin/v1/families`)  · **Milestone:** M5 · **Layer:** admin
**Why** — Find a family without seeing its money. Design: `AdminFamilies.dc.html`.
**Files** — C `apps/admin/app/(console)/families/page.tsx`, `components/families/{FamilyFilters.tsx,FamilyTable.tsx,FamilyStatusPill.tsx}`, `lib/api/hooks/useFamilies.ts`
**Steps**
1. Title "Families · {total} total" and outline button "Export list (CSV)" (`GET /admin/v1/families?format=csv` with the active filters, download via a plain link on the proxy path).
2. `FamilyFilters`: search (placeholder "Search by family name or owner phone (last 3 digits shown)", debounced 300 ms; typing digits searches by last 3), selects **Plan** (All, Free, Plus, Probashi), **Status** (All, Active, No owner, Dormant, Suspended), **AI quota** (Any, Over 90%); state lives in the URL query (`q, plan, status, quota, sort, page`).
3. Table columns: Family, Owner (`••• 678` or "— none —"), Members, Plan, AI used (`93 / 100`), Last active (Today / Yesterday / "9 days ago"), Status pill (✓ Active, ⚠ No owner, "Dormant", ■ Suspended), "Open" link → `/families/:id`. Sortable: Family, Members, AI used, Last active.
4. Footer: "Showing 1–7 of 1,312 · only counts and status, no transaction data" and pagination (cursor-based; page numbers rendered from `page` index when the API returns `pageCount`).
5. Empty result: "No families match these filters." with a "Clear filters" button.
**Contract** — `GET /admin/v1/families?q&plan&status&quota&sort&cursor&limit=25` → `{items:[{id,name,ownerPhoneMasked,members,plan,aiUsed,aiLimit,lastActiveAt,status}], total, nextCursor}`.
**Tests** — `FamilyFilters.test.tsx › "filters round-trip through the URL"`; `FamilyTable.test.tsx › "status pill has icon and word"`, `› "owner none shown for no_owner"`; `useFamilies.test.ts › "keeps previous page while loading"`; `families.page.test.tsx › "export link keeps filters"`.
**Acceptance** — `pnpm --filter @amar-poribar/admin test --run components/families app/\(console\)/families`.
**Done when** — all four filters change the request and the URL.

### T-ADMUI-07 · C3 Family detail and guarded actions
- **Closes:** FR-ADM-04, FR-ADM-06, FR-FAM-07, FR-FAM-09, AC-30 (UI)
- **Depends on:** T-ADMUI-06; T-ADM (`/admin/v1/families/:id` and action routes), T-FAM  · **Milestone:** M5 · **Layer:** admin
**Why** — The only place staff change a family. Design: `AdminFamily.dc.html`.
**Files** — C `apps/admin/app/(console)/families/[id]/page.tsx`, `components/family/{MembersCard.tsx,PlanQuotaCard.tsx,UsageCard.tsx,StaffActionsCard.tsx,RiskyActionsCard.tsx,ChangePlanDialog.tsx,AddQuotaDialog.tsx,TransferOwnershipDialog.tsx}`
**Steps**
1. Back link "← All families"; title family name (Bangla), meta "Created 3 Aug 2026 · ID fam_8f2c…41a"; right status pill.
2. Cards (auto-fit grid, min 300 px): **Members (n)** rows name · masked phone · role pill (Owner green-100/Admin/Member/Viewer), pending invite row "Pending invite ••• 432 · 6 days left", button "Transfer ownership…". **Plan & AI quota**: Plan, "AI entries this month 93 / 100", 12 px bar (amber ≥ 90%), "Resets on 1 Dec · cost this month: ৳ 9.8", buttons "Change plan", "Add 50 entries". **Usage (counts only)**: entries this month, voice share %, devices signed in, last sync; footnote with lock icon "Transactions, chat and media are hidden from staff." **Recent staff actions**: three latest audit rows with link "Open full audit log" (→ `/audit?family=<id>`).
3. **Risky actions** (red-tinted card, `#FFF6F4`, border `#E3B1AB`): text "Each action asks for a reason, then you type the family name to confirm. It is written to the audit log with your name."; buttons "Suspend family" (outline red; becomes "Unsuspend family" when suspended) and "Delete family and data…" (solid red).
4. Dialog flows (all via `ReasonDialog`/`TypedConfirmDialog`; the API also rejects missing reason with `400 reason_required` and missing `confirmFamilyName` for destructive actions with `400 confirm_required`):
   - Change plan: select plan + reason → `POST …/plan {plan, reason}`.
   - Add entries: number (1–500) + reason → `POST …/quota {add, reason}`.
   - Transfer ownership: select an admin/member + reason → `POST …/transfer-ownership {toUserId, reason}`.
   - Suspend / unsuspend: reason (+ typed name for suspend) → `POST …/suspend {reason, confirmFamilyName}`.
   - Delete: reason + typed name + extra checkbox "I understand this starts the 30-day deletion process" → `POST …/delete {reason, confirmFamilyName}`; the page then shows banner "Deletion scheduled for {date}" with the privacy request link.
5. Role gating via `can(role, action)`: Support sees Change plan, Add entries, Transfer ownership only; Read-only sees no buttons (cards show "You have read-only access.").
6. After any action: toast "Done. Recorded in the audit log.", invalidate detail and audit queries.
**Contract** — `GET /admin/v1/families/:id` → `{id,name,createdAt,status,members:[{displayName,phoneMasked,role}],pendingInvites:[{phoneMasked,expiresAt}],plan,ai:{used,limit,resetsOn,costPaisa},usage:{entries,voiceShare,devices,lastSyncAt},recentActions:[…]}`; action routes as listed in SRS §5.2; errors `reason_required`, `confirm_required`, `forbidden`, `family_has_no_eligible_owner`.
**Tests** — `RiskyActionsCard.test.tsx › "delete needs reason, typed name and checkbox"` (AC-30), `› "support sees no suspend or delete"`; `TypedConfirmDialog` covered in T-ADMUI-04; `PlanQuotaCard.test.tsx › "bar turns amber at 90%"`; `MembersCard.test.tsx › "phones are masked"`; `ChangePlanDialog.test.tsx › "posts plan and reason"`.
**Acceptance** — `pnpm --filter @amar-poribar/admin test --run components/family`.
**Done when** — every action in mock mode posts the expected body and shows the toast.

### T-ADMUI-08 · C4 Privacy requests queue and step handler
- **Closes:** FR-ADM-05, FR-PRIV-05, AC-27/28 (UI visibility)
- **Depends on:** T-ADMUI-04; T-ADM, T-PRIV (`/admin/v1/privacy-requests`)  · **Milestone:** M5 · **Layer:** admin
**Why** — PDPO deadlines must never be missed. Design: `AdminPrivacy.dc.html`.
**Files** — C `apps/admin/app/(console)/privacy/page.tsx`, `components/privacy/{RequestTabs.tsx,RequestTable.tsx,DeadlinePill.tsx,StepList.tsx,RejectDialog.tsx}`
**Steps**
1. Title "Privacy requests", sub "Data export and deletion must be finished within 30 days of the request (PDPO 2025)."; tabs as pills **Open · 3**, **Done · 41**, **Rejected · 2** (counts from the API).
2. Table columns: Request (`#PR-0192`), Type (Delete account / Export my data), Person (`••• 457`), Family, Received (`30 Oct`), Deadline pill, Step, action button ("Continue" or dark "Act now" when ≤ 5 days).
3. `DeadlinePill`: `> 10 days` neutral "22 days left"; `≤ 10` ⚠ amber "18 days left"; `≤ 5` ■ red "5 days left"; overdue ■ red "Overdue by n days". Text always present.
4. Selecting a row opens the detail card below (`#PR-0188 · Delete account`) with the ordered checklist from the design: "Confirm the person owns the phone number (OTP)" ✓ Done; "This person is the family owner. Ask them to transfer ownership, or delete the whole family" Waiting; "Offer a data export before deleting"; "Delete profile, sessions and personal data (transactions they wrote stay, with the name removed)"; "Send the person a confirmation by SMS" — each with a status pill (✓ Done / Waiting / To do). Buttons: **Message the owner** (sends the inbox + SMS notification through `POST …/:id/advance {action:"notify_owner"}`), **Reject with reason…** (`RejectDialog`, reason ≥ 10 characters).
5. "Continue" advances to the next automatable step with `POST /admin/v1/privacy-requests/:id/advance`; steps that the system performs by itself show "Runs automatically — next run {time}" and no button.
6. Role gating: Read-only cannot advance or reject.
**Contract** — `GET /admin/v1/privacy-requests?status=open|done|rejected&cursor` → `{items:[{id,kind,personPhoneMasked,familyName,receivedAt,dueAt,step,steps:[{key,label,state}]}], counts}`.
**Tests** — `DeadlinePill.test.tsx › "7 days is amber warning and 4 days red"`, `› "overdue text"`; `StepList.test.tsx › "states have text"`; `RequestTable.test.tsx › "act now when ≤ 5 days"`; `RejectDialog.test.tsx › "reason required"`.
**Acceptance** — `pnpm --filter @amar-poribar/admin test --run components/privacy`.
**Done when** — design fixture renders three requests with the deadline colouring.

### T-ADMUI-09 · G1 Plans and AI quota
- **Closes:** FR-ADM-07, FR-BILL-01, FR-AI-12, FR-AI-15, NFR-13
- **Depends on:** T-ADMUI-04; T-ADM, T-BILL (`GET/PUT /admin/v1/plans`)  · **Milestone:** M8 · **Layer:** admin
**Why** — Tune plan limits and watch AI cost. Design: `AdminPlans.dc.html`.
**Files** — C `apps/admin/app/(console)/plans/page.tsx`, `components/plans/{PlanCard.tsx,QuotaEditor.tsx,AiCostCard.tsx,NearQuotaTable.tsx,QuotaRuleCard.tsx}`
**Steps**
1. Title "Plans & AI quota", sub "Changes apply from the next billing month".
2. Three `PlanCard`s: **Free** · 1,021 families · ৳ 0 · "Up to 3 members / 100 AI entries per month / 6-month history"; **Poribar Plus** · 231 · "৳ 99 / month · ৳ 999 / year" · "Up to 8 members, unlimited history / 1,000 AI entries per month / Voice and receipt entry, Ask / Export"; **Probashi** · 60 · "৳ 149 / month" · "Everything in Plus / Remittance planner / Multi-currency (SAR, AED, MYR, GBP to BDT)". Each with `QuotaEditor` ("AI entries per month" number + Save) and, for staff owner only, price/member-limit fields.
3. `AiCostCard`: "AI cost per active family ৳ 11.4 this month", progress "76% of the ৳ 15 goal (NFR-13) · ✓ Within goal" (⚠ when > 90%), note "Template fallback is used when quota runs out, so cost stops at the limit."
4. `QuotaRuleCard` "When quota runs out": "Members fall back to manual entry. The SMS parser and the offline quick parser still work with no AI. Monthly summary switches to the fixed template."
5. `NearQuotaTable` "Families near quota — Counts only. Staff cannot see what was entered.": Family, Plan, AI used, Resets, State (■ Quota reached / ⚠ 93% used / ✓ On track), Open link.
6. Saving a quota: `PUT /admin/v1/plans/:id {aiQuotaMonth}` with `ReasonDialog`; only Owner and Support (quota only) can save.
**Tests** — `QuotaEditor.test.tsx › "needs reason and positive integer"`; `AiCostCard.test.tsx › "goal met shows check"`, `› "over 90% shows warning"`; `NearQuotaTable.test.tsx › "states have icons and words"`; `PlanCard.test.tsx › "price fields only for staff owner"`.
**Acceptance** — `pnpm --filter @amar-poribar/admin test --run components/plans`.
**Done when** — fixture reproduces the design counts.

### T-ADMUI-10 · G2 Audit log with filters, export and hash-chain status
- **Closes:** FR-ADM-08, NFR-23, AC-30 (UI)
- **Depends on:** T-ADMUI-04; T-ADM (`GET /admin/v1/audit`, `audit/export.csv`)  · **Milestone:** M5 · **Layer:** admin
**Why** — Proof of who did what. Design: `AdminAudit.dc.html`.
**Files** — C `apps/admin/app/(console)/audit/page.tsx`, `components/audit/{AuditFilters.tsx,AuditTable.tsx,KindPill.tsx,ChainStatus.tsx}`
**Steps**
1. Title "Audit log", right "Export (CSV)" (link to `/api/proxy/admin/v1/audit/export.csv` with the filters); note under title "Entries cannot be edited or deleted by anyone, including the owner. They are kept for 2 years."
2. Filters: **Staff** (All + names), **Action** (All, Signed in, Changed plan, Added AI entries, Suspended family, Viewed family page, Started privacy request, Failed sign-in…), **Family name** text, **Date** (Last 7 days, Last 30 days, Custom range); in the URL.
3. Table: When (`11 Nov, 09:12`, Asia/Dhaka), Who, Action, Family (or "—"), Reason (or "—"), Kind pill (■ Risky, ⚠ Privacy, "Read", "Change", "Sign-in", ⚠ Security).
4. Footer "Showing 1–7 of 214 · times in Asia/Dhaka" + pagination.
5. `ChainStatus` (top-right small pill): "✓ Chain verified through #{id}" or "■ Chain broken at #{id}" taken from the list response `chain` meta; a "Verify now" button calls `GET /admin/v1/audit/verify` (an `admin` route the T-ADM audit task also adds) and refreshes the pill. If the endpoint is missing in the OpenAPI document, the button is hidden and only the meta is used.
6. No edit or delete affordances anywhere; a test asserts the DOM has no such buttons.
**Contract** — `GET /admin/v1/audit?staff&action&family&from&to&cursor&limit=50` → `{items:[{id,at,staffName,action,kind,familyName,reason}], nextCursor, total, chain:{ok,verifiedThrough,brokenAt?}}`.
**Tests** — `AuditTable.test.tsx › "kind pills have words"`, `› "no edit or delete controls"`; `AuditFilters.test.tsx › "filters in URL"`; `ChainStatus.test.tsx › "broken chain is red with id"`.
**Acceptance** — `pnpm --filter @amar-poribar/admin test --run components/audit`.
**Done when** — after any action in the mock family-detail flow, the audit page shows a new top row.

### T-ADMUI-11 · G3 Staff accounts and role matrix
- **Closes:** FR-ADM-09, FR-ADM-01 (reset 2FA), NFR-23
- **Depends on:** T-ADMUI-04; T-ADM (`/admin/v1/staff`)  · **Milestone:** M5 · **Layer:** admin
**Why** — Manage who can use the console. Design: `AdminStaff.dc.html`.
**Files** — C `apps/admin/app/(console)/staff/page.tsx`, `components/staff/{StaffTable.tsx,InviteStaffForm.tsx,RoleMatrix.tsx,RoleSelect.tsx}`
**Steps**
1. Title "Staff accounts", sub "Staff sign in with email, password and a 2FA code. Every action is written to the audit log."
2. Table: Name, Email, Role, 2FA (✓ Enabled / ⚠ Not set), Last sign-in (Today, 09:02 / Yesterday, 17:30 / Never), Status (✓ Active / ⚠ Locked until 2FA), row actions: "Change role", "Send reminder", "Disable", "Reset 2FA" (each with `ReasonDialog`; hidden for yourself and for non-owners).
3. **Invite staff** card: "Work email" (`name@amarporibar.example` placeholder), Role select (Support, Read-only, Owner), "Send invite", note "The invite link works for 48 hours. 2FA setup is required at first sign-in."
4. **What each role can do** matrix with ✓ Yes / ✗ No text for: View families (counts only), Change plan or quota, Suspend a family, Delete family data, Handle privacy requests, Manage staff; footer "No role can see transactions, notes, chat, voice or video." The matrix is generated from `lib/permissions.ts` so it cannot drift from behaviour (test below).
5. Only Staff Owner sees the page's actions; others get read-only table or a "You do not have access" `EmptyState` (Support/Read-only cannot open `/staff`; middleware-free guard in the page using `useStaff`).
**Contract** — `GET /admin/v1/staff` → `[{id,name,email,role,totpEnabled,lastSignInAt,status}]`; `POST /admin/v1/staff {email, role}` → 201; `PATCH /admin/v1/staff/:id {role?, disabled?, resetTotp?, reason}`.
**Tests** — `RoleMatrix.test.tsx › "matrix equals permissions.ts"`; `StaffTable.test.tsx › "own row has no disable"`, `› "locked until 2FA shows warning and reminder button"`; `InviteStaffForm.test.tsx › "invalid email rejected"`.
**Acceptance** — `pnpm --filter @amar-poribar/admin test --run components/staff`.
**Done when** — the matrix and the buttons visible to each role in mock mode agree.

### T-ADMUI-12 · G4 System health
- **Closes:** FR-ADM-10, NFR-04, NFR-08, NFR-12
- **Depends on:** T-ADMUI-04; T-ADM, T-PLAT (`GET /admin/v1/health`)  · **Milestone:** M5 · **Layer:** admin
**Why** — See problems before families report them. Design: `AdminHealth.dc.html`.
**Files** — C `apps/admin/app/(console)/health/page.tsx`, `components/health/{MetricTile.tsx,BackupCard.tsx,IncidentList.tsx,QueueCard.tsx}`
**Steps**
1. Title "System health", sub "Last 30 days · updated {time} (Asia/Dhaka)"; auto-refresh every 60 s.
2. `MetricTile`s (value 30 px + status line with icon and word): **API availability** 99.71% "✓ Meets 99.5% target"; **p95 API latency (CRUD)** 212 ms "✓ Under 300 ms"; **OTP delivery rate** 95.8% "⚠ Below usual 98.5%"; **Push (FCM) delivery rate** 97.4% "✓ Normal"; **SMS gateway** "Slow" "⚠ Median send time 9 s"; **AI errors and template fallback** 1.3% "✓ Normal · fallback used 41 times". Thresholds come from the API (`status` field), not from the UI.
3. `BackupCard` "Backups (NFR-08)": Last daily backup "Today, 03:00 ✓ Done", "Backups kept 14 days", Last restore test "{date} ✓ Passed", **Next restore test: weekly (automated)** — the design copy says "every quarter"; follow SRS NFR-08 (weekly automated restore test) and show the API's `nextRestoreTestAt`.
4. `QueueCard` (added): job queue depth and dead letters (SRS FR-ADM-10) with "Dead letters: 0 ✓" or "⚠ n need attention".
5. `IncidentList` "Recent incidents": title, start and note, pill ⚠ Watching / ✓ Resolved.
6. Footer lock note "Logs and metrics here contain counts and timings only. No phone numbers, names, notes or message content (NFR-12)."
**Contract** — `GET /admin/v1/health` → `{asOf, tiles:[{key,label,value,unit,status:"ok"|"warn"|"risk",note}], backups:{lastAt,keptDays,lastRestoreAt,lastRestoreOk,nextRestoreAt}, queue:{depth,deadLetters}, incidents:[{title,startedAt,note,state}]}`.
**Tests** — `MetricTile.test.tsx › "status icon and word for ok warn risk"`; `BackupCard.test.tsx › "shows weekly cadence"`; `IncidentList.test.tsx › "watching vs resolved"`; `health.page.test.tsx › "refetches every 60 seconds"` (fake timers).
**Acceptance** — `pnpm --filter @amar-poribar/admin test --run components/health`.
**Done when** — fixture reproduces the design tiles and the weekly restore wording.

### T-ADMUI-13 · Staff data boundary test (sentinel crawl)
- **Closes:** FR-ADM-11, AC-31 (UI side), NFR-23
- **Depends on:** T-ADMUI-05..12; T-ADM (sentinel fixtures in `tools/fixtures`)  · **Milestone:** M5 · **Layer:** admin
**Why** — Prove, automatically, that no private value can reach staff screens.
**Files**
- C `apps/admin/e2e/flows/ac-31-sentinels.spec.ts`, `apps/admin/e2e/helpers/sentinels.ts`
- C `apps/admin/lib/api/private-fields.test.ts`
**Steps**
1. `sentinels.ts` exports distinctive strings that the seeded family data contains: transaction note `SENTINEL_NOTE_7f3a`, counterparty `SENTINEL_CP_91bc`, chat body `SENTINEL_CHAT_44de`, TrxID `SENTINELTRX01`, full phone `+8801799900011`, voice note media id `SENTINEL_MEDIA_5e20`, private-flag note `SENTINEL_PRIVATE_0aa9`.
2. The spec seeds a family with all of them (through `tools/fixtures`), signs in as each staff role, visits every console route (`/`, `/families`, `/families/:id`, `/privacy`, `/plans`, `/audit`, `/staff`, `/health`) and for each: (a) records every `/api/proxy/admin/**` response via `page.on("response")` and asserts none contains a sentinel (also not base64/URL-encoded forms), (b) asserts `page.content()` contains none, (c) asserts the phone column text matches `/^•••\s?\d{3}$/`.
3. `private-fields.test.ts` (Vitest): parses `apps/admin/lib/api/schema.d.ts` and fails if any property name from `private-fields.ts` appears in an `/admin/v1` response type.
4. ESLint rule from T-ADMUI-01 already blocks importing private-field names; add a grep test `› "components never reference private field names"`.
**Tests** — the spec and the unit test above (`ac-31-sentinels.spec.ts › "no sentinel reaches any admin screen or response"`).
**Acceptance** — `pnpm --filter @amar-poribar/admin test --run lib/api` and `pnpm --filter @amar-poribar/admin e2e --grep AC-31` (stack variant).
**Done when** — both pass; adding a sentinel field to any admin response type makes them fail (verified by a negative test that temporarily patches the schema in memory).

### T-ADMUI-14 · Playwright admin flows (AC-29, AC-30), accessibility and visual specs
- **Closes:** AC-29, AC-30, NFR-10, NFR-24, FR-ADM-01..10 (UI)
- **Depends on:** T-ADMUI-03..13, T-WEB-37 (shared patterns)  · **Milestone:** M5 · **Layer:** admin
**Files**
- C `apps/admin/e2e/playwright.config.ts` (project `desktop` 1280×800, locale `en-GB`, timezone `Asia/Dhaka`, `maxDiffPixelRatio: 0.02`), `e2e/fixtures/{test.ts,staff.ts}`, `e2e/helpers/{a11y.ts,totp.ts,visual.ts}`
- C `apps/admin/e2e/flows/{ac-29-auth.spec.ts,ac-30-actions.spec.ts,navigation.spec.ts,roles.spec.ts}`, `e2e/visual/screens.spec.ts`, `e2e/__screenshots__/**`
**Steps**
1. `totp.ts`: computes the current TOTP from the seeded secret (RFC 6238 SHA-1, 30 s) so tests can sign in; `staff.ts` creates staff users through `tools/fixtures` (Owner, Support, Read-only).
2. `ac-29-auth.spec.ts › "sign-in requires TOTP"`: password alone never reaches the console; `› "five wrong attempts lock for 15 minutes"` (assert the countdown text, then advance the fake clock endpoint); `› "staff cookie fails on family routes"`: with the staff cookie, `request.get("/api/proxy/v1/me")` is 404 on the admin proxy, and a direct API call with the staff token to `/v1/me` returns 401.
3. `ac-30-actions.spec.ts › "actions need a reason"`: submitting the Change-plan dialog with 5 characters keeps the button disabled; forcing the request through the API (without reason) returns `reason_required`; `› "delete needs typed family name"`; `› "successful action appends an audit entry whose chain verifies"`: after Suspend, open `/audit`, assert a "Suspended family" row at the top with kind "Risky" and `ChainStatus` "Chain verified".
4. `roles.spec.ts › "support has no suspend or delete and no staff page"`, `› "read-only has no action buttons anywhere"`.
5. `navigation.spec.ts`: all sidebar links reach their pages and `checkA11y` passes (rules `wcag2a, wcag2aa, wcag21aa`) on every console page, the login page and each open dialog.
6. `visual/screens.spec.ts`: snapshots for C0, C1, C2, C3, C4, G1, G2, G3, G4 at 1280×800 and C1/C2/C3 at 390×844 (stacked sidebar) with frozen clock `2026-11-11T10:00:00+06:00`; baselines produced by `scripts/snapshots-docker.sh` (same pinned Playwright image as T-WEB-40) and committed. A conformance block asserts: inputs ≥ 44 px high, status pills contain an icon and text, no horizontal page scroll at 1280 and 390 widths, token colours equal the design values.
**Tests** — the specs above.
**Acceptance** — `pnpm --filter @amar-poribar/admin e2e:mock` (UI specs) and `pnpm --filter @amar-poribar/admin e2e --grep "AC-29|AC-30"` against Compose.
**Done when** — all specs pass in CI (job `admin`, T-WEB-41) and the visual baselines are committed.

---

## 3. Coverage map

| SRS item | Tasks |
|---|---|
| FR-AUTH-01, -02, -07, -09, -10, -11 (web) | T-WEB-03, -10, -11, -12, -36 |
| FR-FAM-02..04, -07, -10 (UI) | T-WEB-12, -22 |
| FR-ACC, FR-CAT (UI) | T-WEB-24 |
| FR-TXN-02, -03, -05, -09, -10 | T-WEB-16, -17, -19 |
| FR-AI-01, -02, -07, -09, -10, -11, -12 (UI) | T-WEB-14, -15, -17, -18, -20, -27 |
| FR-BUD-01, -02, -04, -06, -07 | T-WEB-13, -21, -25 |
| FR-REC-01..03 | T-WEB-25 |
| FR-REP-02..05 | T-WEB-19, -26 |
| FR-NOT-01..03, FR-NOTIF-04..07 (web) | T-WEB-23, -28, -36 |
| FR-VOICE-01..08 (web) | T-WEB-09, -13, -14, -20 |
| FR-VOICE-09 (web) | T-WEB-05, -13, -23 |
| FR-NUDGE-01..08 | T-WEB-32, -36 |
| FR-CHAT-01..08 | T-WEB-33 |
| FR-VNOTE-01..04, FR-VMSG-01 | T-WEB-34 |
| FR-VIDEO-01..09 | T-WEB-35 |
| FR-PRES-01, -02 | T-WEB-13, -22, -23, -31 |
| FR-SHOP-01..03 | T-WEB-29 |
| FR-BILL-01..06 (UI) | T-WEB-27 |
| FR-PRIV-01..04 (UI) | T-WEB-11, -30 |
| FR-ONB, FR-A11Y, FR-I18N, FR-NAV, FR-HOME | T-WEB-05..08, -11, -13, -40 |
| FR-ADM-01 | T-ADMUI-02, -03, -11 |
| FR-ADM-02 | T-ADMUI-05 |
| FR-ADM-03 | T-ADMUI-06 |
| FR-ADM-04, -06 | T-ADMUI-07 |
| FR-ADM-05 | T-ADMUI-08 |
| FR-ADM-07 | T-ADMUI-09 |
| FR-ADM-08 | T-ADMUI-10 |
| FR-ADM-09 | T-ADMUI-04, -11 |
| FR-ADM-10 | T-ADMUI-12 |
| FR-ADM-11, AC-31 | T-ADMUI-13 |
| AC-01..14 (web) | T-WEB-38 |
| AC-15, 16, 18, 19, 20, 22, 32 (web) | T-WEB-39 |
| AC-29, AC-30 | T-ADMUI-14 |
| NFR-24 (web, admin) | T-WEB-40, T-ADMUI-14 |
| GAP-WEB-01..05, GAP-ADMUI-01 | T-WEB-02, -03, -19, -31, -37, T-ADMUI-01 |

**Not on web by design** (mobile only per SRS §5.1.3): `D2` tutorial, `D3` Simple-mode home (web gets an equivalent layout in T-WEB-13 through the `data-simple` flag), `E8` dhar, `F4` offline/nearby sync, screen `6` native full-screen vibration (web gets the overlay in T-WEB-32).

## 4. Added after design verification

### T-WEB-42 · Design string conformance test (web)
- **Closes:** NFR-09, NFR-24, FR-I18N-01
- **Depends on:** T-WEB-05 (i18n), each web screen task for its strings
- **Milestone:** M2
- **Layer:** web
**Why** — Same reason as T-MOB-77: verification found design strings that no task quoted. The test keeps web copy equal to the design.
**Files**
- C `apps/web/test/design-strings.test.ts` (Vitest)
- C `apps/web/test/allowed-differences.json` (≤ 30 entries, each with a `reason`)
- C `apps/web/test/screen-registry.ts` — `export const implementedScreens: Record<string,string>` mapping design screen name to the route or component file
- M `packages/shared/src/i18n/bn.ts` — add the static strings the web screens use
**Steps**
1. Load `docs/design/strings.json`; for each screen in `screen-registry.ts` (web implements every non-admin screen except `Tutorial`, `SimpleHome`, `Incoming`, `SyncStatus`, `Dhar`), assert each `static` string is a substring of a value in `packages/shared/src/i18n/bn.ts`, or is listed in `allowed-differences.json`.
2. Assert the allowed list has ≤ 30 entries and every entry has a `reason`.
3. Strict mode when all 38 web screens are registered.
**Tests** — `every static design string exists in bn.ts`, `allowed differences are few and explained`, `strict: all web screens registered`.
**Acceptance** — `pnpm --filter @amar-poribar/web test design-strings` passes; `node tools/design/extract-strings.mjs --check` exits 0.
**Done when** — Web copy cannot drift from the design without a failing test.
