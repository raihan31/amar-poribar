# Mobile tasks (`apps/mobile`, area `T-MOB`)

Flutter 3 / Dart 3 Android app (iOS later). Implements the screens in SRS §5.1.3 and the behaviour in SRS §4 (FR-AUTH … FR-A11Y), §5.4 (WebSocket), §8 (communication), §9 (sync). Read [README.md](./README.md) first for the rules (no human gates, CI is the gate, every task = one PR, ports + fakes).

Visual spec: the design canvas https://claude.ai/artifact/4h5SPurNz7kAb1oJQdozwW. Each screen task names its board file (for example `Chat.dc.html`); the design sources are saved in the repository at `docs/design/screens/*.dc.html` by T-MOB-52, and the golden image of the implemented screen must match the board within 2%.

## 0. Current state of `apps/mobile` (verified at commit `e2ef7bc`)

| Area | What exists | Where |
|---|---|---|
| Navigation | `MaterialPageRoute` switch with 8 routes (`/`, `/dashboard`, `/transactions`, `/pending-sms`, `/settings`, `/login`, `/ai-entry`, `/tutorial`), initial route is the onboarding screen | `lib/presentation/navigation/app_router.dart`, `lib/main.dart` |
| State | `AppStateNotifier` (monthly totals + 20 recent as `double` taka, local `Role {father,mother,child}`, fake `monthlyBudget = 100000`), `AuthNotifier` (token + first family), providers for `ApiClient`, `SyncService`, `PendingQueue`, `VoiceService` | `lib/presentation/providers/*.dart`, `lib/domain/models/enums.dart` |
| Local DB | Drift `AppDatabase` schema v3: `Transactions` (with `hlc`, `localSeq`, tombstone `deletedAt`), `CachedCategories`, `CachedAccounts` (id, name, type only), `Meta`, `PendingEntries` (offline AI queue) | `lib/data/database/{tables,database,local_store}.dart` |
| Sync | HLC (`hlc.dart`), `LocalStore.changesAfter/applyChanges`, `SyncService.sync(familyId)` against `POST /v1/families/:id/sync`, peer sync over Nearby Connections (`nearby_transport.dart`, `peer_sync_engine.dart`), offline AI queue (`pending_queue.dart`) | `lib/data/sync/*` |
| API client | Hand-written `ApiClient` (OTP, families, categories, accounts, parse, summary, sync, budgets), `TransactionDraft`, `FamilyInfo`, `ApiException`; base URL from `--dart-define=API_URL` | `lib/data/api/api_client.dart` |
| Voice | `VoiceService` interface + `DeviceVoiceService` (speech_to_text `bn_BD`, flutter_tts `bn-BD` rate 0.45), Bangla number words, category keywords, budget alert text logic, tutorial script | `lib/core/speech/*` |
| Screens | onboarding, login (phone + OTP), dashboard (placeholder data, glass card), transaction (simple add), AI entry (type / paste / speak, drafts, summary), settings (sync, nearby sync switch, tutorial link, "Bank Approvals" placeholder), tutorial | `lib/presentation/screens/*.dart` |
| Tests | 12 test files: bangla words, budget alerts, sms parser, api client, hlc, local store, peer sync, pending queue, sync service, ai entry voice, app state, tutorial | `apps/mobile/test/**` |
| Android | Manifest has `INTERNET`, `RECORD_AUDIO`, Nearby/Bluetooth/Wi-Fi permissions, speech and TTS `<queries>`; no notification, vibration, camera, full-screen-intent permissions; release signed with debug key | `android/app/src/main/AndroidManifest.xml`, `android/app/build.gradle.kts` |
| CI | `flutter test` and `flutter analyze` (non-blocking) after `build_runner` | `.github/workflows/ci.yml` |

## 1. Conventions for every mobile task

**Folder structure for new code** (feature-first, Riverpod):
```
lib/
  app/                  app.dart, router.dart, shell (tab scaffold), theme wiring, bootstrap
  core/                 tokens, theme, money, numerals, l10n helpers, speech, vibration, permissions
  ui/                   shared widget kit (T-MOB-06)
  data/                 api/, database/, sync/, realtime/, media/ (existing folders stay)
  features/<name>/      data/ (repository interface + implementation + fake), state/ (providers), ui/ (screens, widgets)
  l10n/                 app_bn.arb, app_en.arb (generated into lib/l10n/gen/)
test/
  features/<name>/      widget + repository tests
  goldens/              golden tests and png files (<code>_<name>.png)
  a11y/                 accessibility audit tests
  contract/             OpenAPI contract tests
```
Existing files under `lib/presentation/**` are moved into `lib/features/**` by the task that replaces each screen (the old file is deleted in that PR, so no dead screens remain).

**Screen task recipe (R-SCREEN)** — every screen task (T-MOB-xx marked *screen*) includes these items even when not repeated in its text:
1. A `<Feature>Repository` **interface** in `features/<name>/data/<name>_repository.dart`, a `Fake<Feature>Repository` in `features/<name>/data/fake_<name>_repository.dart` (in memory, deterministic seed from the design's sample data), and a Riverpod provider `<name>RepositoryProvider` whose default implementation is the real one and which tests override. **UI work never waits for the backend**: build and test against the fake; the real implementation is a separate small task or the last step of the same task when the backend route already exists.
2. The screen widget and a route constant in `lib/app/router.dart`.
3. Strings only through `AppLocalizations` (keys listed in the task; both `app_bn.arb` and `app_en.arb`).
4. A **widget test** `test/features/<name>/<screen>_test.dart` covering the listed behaviours with the fake repository.
5. A **semantics test** using `tester.getSemantics` through the shared helper `expectAllTappablesLabelled(tester)` (T-MOB-51): every tappable has a non-empty Bangla label, every tappable is ≥ 48 dp, primary actions ≥ 56 dp (≥ 72 dp in Simple mode).
6. A **golden test** `test/goldens/<code>_<name>_golden_test.dart` writing `test/goldens/<code>_<name>.png` at 390×844 with the shared tolerance comparator (2%, T-MOB-52). Light theme always; dark theme variant `<code>_<name>_dark.png` for tab screens (Main, B1, B3, B4, F1).
7. `cd apps/mobile && dart format --set-exit-if-changed lib test && flutter analyze && flutter test test/features/<name> test/a11y test/goldens/<code>_*` as the acceptance command (shown as **Acceptance: standard** below).

**Colours and sizes** quoted by tasks (design tokens, T-MOB-02): background `#FFF8EE`, ink `#2A2118`, muted `#5A4B3B`, green `#1B5E20`, deep green `#14451A`, green tint `#E6F2E3`, amber `#F2A33A`, amber tint `#FDEBCB` (text `#6B3F00`), danger `#B3261E`, danger tint `#F8D7D3` (text `#8A1C14`), border `#E8DCC8`, input border `#E1D3BC`, call background `#14110D`. Avatar pairs (background/foreground): আম্মু `#F4C7B8/#7A2E14`, আব্বু `#BFD8F2/#173F6B`, দাদি `#E3D2F2/#4A2670`, তানভীর `#CDE8C8/#1B5E20`. Font Hind Siliguri. Touch ≥ 48 dp, primary ≥ 56 dp, big actions 72–104 dp as drawn.

**New dependencies** (added by the task that first needs them; versions are the minimum to use, `flutter pub add` resolves compatible ones):
`go_router ^14.6.0`, `flutter_localizations` (sdk), `intl` (as pinned by the SDK), `flutter_secure_storage ^9.2.2`, `connectivity_plus ^6.1.0`, `web_socket_channel ^3.0.1`, `firebase_core ^3.8.0`, `firebase_messaging ^15.1.5`, `flutter_local_notifications ^18.0.1`, `vibration ^2.0.1`, `record ^5.1.2`, `just_audio ^0.9.40`, `camera ^0.11.0`, `image_picker ^1.1.2`, `flutter_image_compress ^2.3.0`, `video_compress ^3.1.3`, `flutter_webrtc ^0.12.5`, `workmanager ^0.5.2`, `share_plus ^10.1.2`, `url_launcher ^6.3.1`, `json_schema ^5.2.0` (dev), `mocktail ^1.0.4` (dev), `alchemist ^0.10.0` (dev), `integration_test` (sdk, dev).

## 2. Dependency graph and parallelism

```
M0/M1 foundation
 01 ─┬─ 02 ─ 03 ─ 06 ─────────────────────────────────────────────┐ (UI kit unblocks every screen)
     ├─ 04 ─ 05 ──────────────────────────────────────────────────┤
     ├─ 07 ─ 08 ─ 09 ─ 12                                          │
     └─ 10 ─ 11 ──────────────────────────────────────────────────┤
                                                                   ▼
M1 auth/onboarding   14 A1 · 15 A7 · 16 F6 · 17 A2 · 18 A6 · 19 D1 · 20 F8 · 21 D2 · 22 D8
M2 ledger            23 Home · 24 txn repo · 25 B1 · 26 D4 · 27 D5 · 28 A3 · 29 A4 · 30 A5 · 31 B2 · 32 B3 · 33 B6 · 34 FCM · 35 F3
M3 comms             36 WS ─ 37 tables ─ 38 F1 · 39 Chat · 40 outbox · 41 buzz · 42 vibration · 43 screen 6 · 44 presence · 45 voice note rec · 46 playback · 47 B4
M4 offline/a11y      48 WorkManager · 49 F4 · 50 Simple mode/D3 · 51 a11y harness · 52 goldens infra (needed EARLY, see below) · 53 F2
M7 P2 screens        54 E1 · 55 E2 · 56 E3 · 57 E4 · 58 E5 · 59 E6 · 60 D6 · 61 D7 · 62 B5 · 63 F5 · 64 F7
M8 growth            65 E7 · 66 E8
M6 video             67 video msg · 68 WebRTC engine · 69 call UI · 70 call integration
Cross-cutting        71 APK size · 72 permissions · 73 empty/error states · 74 deep-link tests · 75 verify scripts · 76 AC test map
```
- **Do first (in this order):** 01, 02, 03, 06, 51, 52 — they are tiny and every screen task uses them. 04, 05, 07, 08 can run in parallel with them.
- **Fully parallel after 06 + 04 + 08:** all screen tasks marked *screen* with a fake repository (14–22, 25–33, 38–39, 41, 43, 47, 49–50, 53–66). Two engineers or agents can take disjoint screens without merge conflicts because each task owns only its own `features/<name>/` folder plus one line in `router.dart` and the ARB files (ARB conflicts are resolved by key prefix per feature: `auth_`, `home_`, `txn_`, …).
- **Backend-dependent real repositories** (the `Api<Feature>Repository` classes) are the last step of each screen task; they need the matching backend task. Until it lands, the task's acceptance is run with the fake (the real one is covered by the contract test T-MOB-10).
- Backend task areas referenced: `T-ID`, `T-FAM`, `T-LED`, `T-BUD`, `T-REC`, `T-AI`, `T-REP`, `T-SYNC`, `T-COMM`, `T-NOTIF`, `T-SHOP`, `T-LEND`, `T-BILL`, `T-PRIV` (files `02-backend-core.md`, `03-backend-engage.md`).

---

## M0/M1 · Foundation

### T-MOB-01 · Baseline: dependencies, strict analysis, blocking CI, feature-first folders
- **Closes:** NFR-11, GAP-ARCH-10, GAP-MOB-14 (partly)
- **Depends on:** —
- **Milestone:** M0
- **Layer:** mobile
**Why** — Later tasks need a clean, green analyzer and a place to put code. Today `flutter analyze` is allowed to fail and generated Drift code is built only in CI.
**Files**
- M `apps/mobile/pubspec.yaml` — add the dev dependencies `mocktail`, `alchemist`, `integration_test` (sdk), `json_schema`; raise `intl` to the version required by `flutter_localizations`; add `flutter_localizations: sdk: flutter`; set `flutter: generate: true`.
- M `apps/mobile/analysis_options.yaml` — keep the existing rules and add: `analyzer: language: strict-casts: true, strict-inference: true, strict-raw-types: true`; linter rules `always_declare_return_types`, `avoid_print`, `unawaited_futures`, `use_build_context_synchronously`, `prefer_const_constructors`, `directives_ordering`.
- M `.github/workflows/ci.yml` — in job `mobile`: remove `continue-on-error: true` from `flutter analyze`; add `dart format --output=none --set-exit-if-changed lib test` and `flutter test --coverage`; add step `dart run tool/check_coverage.dart 70 lib/domain lib/data lib/core coverage/lcov.info`.
- C `apps/mobile/tool/check_coverage.dart` — reads `lcov.info`, sums line coverage for the given folders, exits 1 below the threshold.
- C `apps/mobile/lib/app/`, `lib/ui/`, `lib/features/`, `lib/core/` placeholders with a `README.md` stating the folder rule from section 1.
- M all files flagged by `flutter analyze` (fix, do not suppress).
**Steps**
1. Run `cd apps/mobile && flutter pub get && dart run build_runner build --delete-conflicting-outputs && flutter analyze` and list every issue (the CI note says the mocked database/sync layer has known errors).
2. Fix each issue at its cause; where a lint is wrong for the file, use `// ignore_for_file:` only for generated files and document nothing else.
3. Add the strict-analysis options, re-run, fix new findings.
4. Add `tool/check_coverage.dart` (about 40 lines: parse `SF:` and `LF:`/`LH:` pairs, filter by path prefixes, print the percentage, exit 1 if below the argument).
5. Update the CI job, keep the `build_runner` step before analyze.
**Contract** — none.
**Tests** — `test/tool/check_coverage_test.dart`: passes on a fixture lcov at 80%, fails at 60%.
**Acceptance** — `cd apps/mobile && flutter pub get && dart run build_runner build --delete-conflicting-outputs && dart format --output=none --set-exit-if-changed lib test && flutter analyze --fatal-infos && flutter test --coverage && dart run tool/check_coverage.dart 70 lib/domain lib/data lib/core coverage/lcov.info`
**Done when** — the CI mobile job fails on any analyzer warning and on coverage below 70% of the three folders.

### T-MOB-02 · Design tokens, light and dark theme, contrast test
- **Closes:** FR-A11Y-03, SRS §5.1.1
- **Depends on:** T-MOB-01
- **Milestone:** M0
- **Layer:** mobile
**Why** — Every screen must use the same palette and sizes as the design.
**Files**
- C `lib/core/theme/tokens.dart` — `class AppTokens` with `static const Color bg = Color(0xFFFFF8EE), ink = Color(0xFF2A2118), muted = Color(0xFF5A4B3B), green = Color(0xFF1B5E20), deepGreen = Color(0xFF14451A), greenTint = Color(0xFFE6F2E3), amber = Color(0xFFF2A33A), amberTint = Color(0xFFFDEBCB), amberInk = Color(0xFF6B3F00), danger = Color(0xFFB3261E), dangerTint = Color(0xFFF8D7D3), dangerInk = Color(0xFF8A1C14), border = Color(0xFFE8DCC8), inputBorder = Color(0xFFE1D3BC), callBg = Color(0xFF14110D)`; `static const double touchMin = 48, primaryMin = 56, simplePrimaryMin = 72, radiusCard = 24, radiusPill = 999;` avatar palette `static const List<AvatarColors> avatars` (4 pairs from section 1).
- C `lib/core/theme/dark_tokens.dart` — dark counterparts: `bg 0xFF1A1510`, `surface 0xFF241E17`, `ink 0xFFF5EDE0`, `muted 0xFFCDBFA8`, `green 0xFF7DD184`, `greenTint 0xFF1F3A22`, `amber 0xFFF2A33A`, `danger 0xFFF2B8B5`, `border 0xFF3A3126`.
- C `lib/core/theme/app_theme.dart` — `ThemeData lightTheme(UiScale scale)`, `ThemeData darkTheme(UiScale scale)` with `useMaterial3: true`, `fontFamily: 'HindSiliguri'`, `ColorScheme` built from tokens (not `fromSeed`), `ElevatedButtonThemeData` (min height 56, full pill, bold 18), `TextButtonThemeData` (min 48), `InputDecorationTheme` (border `inputBorder`, radius 16, focused 3 dp green), `CardThemeData` (radius 24, border), `NavigationBarThemeData` (height 72, label always shown, selected `green`).
- C `lib/core/theme/ui_scale.dart` — `enum UiScale { normal, simple }` with `textScale` 1.0 / 1.3 and `primaryHeight` 56 / 72.
- M `lib/main.dart` — replace the two inline `ThemeData` with `lightTheme/darkTheme`; `themeMode: ThemeMode.system`.
**Steps** — 1. Add token files. 2. Implement themes. 3. Delete the `fromSeed` themes. 4. Add the contrast helper `double contrast(Color a, Color b)` in `lib/core/theme/contrast.dart` (WCAG relative luminance).
**Contract** — none.
**Tests** — `test/core/theme/contrast_test.dart`: for each pair in `AppTokens.textPairs` (ink/bg, muted/bg, white/green, ink/amber, amberInk/amberTint, dangerInk/dangerTint, deepGreen/greenTint, white/danger) and the dark pairs, contrast ≥ 4.5; `theme_test.dart`: `lightTheme(UiScale.simple).elevatedButtonTheme.style` has minimum height 72.
**Acceptance** — `cd apps/mobile && flutter test test/core/theme`
**Done when** — no screen references `Colors.green`, `Colors.grey` or `Theme.of(context).colorScheme.primary` for brand colours (enforced by `test/core/no_raw_colors_test.dart`, which greps `lib/features` and `lib/ui` for `Colors.` and fails on matches except `Colors.transparent` and `Colors.white`).

### T-MOB-03 · Bundle Hind Siliguri
- **Closes:** NFR-09 (fonts), SRS §5.1.1
- **Depends on:** T-MOB-01
- **Milestone:** M0
- **Layer:** mobile
**Why** — The design uses Hind Siliguri 400/500/600/700; the app must render Bangla identically offline and in golden tests.
**Files** — C `assets/fonts/HindSiliguri-{Regular,Medium,SemiBold,Bold}.ttf` (OFL licence file `assets/fonts/OFL.txt`); M `pubspec.yaml` `fonts:` block family `HindSiliguri` with weights 400/500/600/700; C `test/flutter_test_config.dart` loading the fonts via `FontLoader('HindSiliguri')` before every test.
**Steps** — 1. Download the four static TTFs from Google Fonts (OFL) into `assets/fonts` through `tool/fetch_fonts.sh` (a script committed in the PR; the font files are committed too so CI needs no network). 2. Register in pubspec. 3. Write `flutter_test_config.dart` that calls `loadAppFonts()` from `alchemist` and the custom loader. 4. Remove any `fontFamily` overrides in screens.
**Contract** — none.
**Tests** — `test/core/theme/font_test.dart`: `Text('আমার পরিবার')` renders with a glyph width > 0 and the family is `HindSiliguri`.
**Acceptance** — `cd apps/mobile && flutter test test/core/theme/font_test.dart && test -f assets/fonts/HindSiliguri-Bold.ttf`
**Done when** — goldens show Hind Siliguri, not Roboto fallback boxes.

### T-MOB-04 · Localisation (bn + en) with key-diff test
- **Closes:** FR-I18N-01, NFR-09, GAP-MOB-04, AC-06
- **Depends on:** T-MOB-01
- **Milestone:** M0
- **Layer:** mobile
**Why** — Strings are hard-coded and mixed. All UI text must come from catalogues, with Bangla as default.
**Files**
- C `apps/mobile/l10n.yaml` (`arb-dir: lib/l10n`, `template-arb-file: app_bn.arb`, `output-localization-file: app_localizations.dart`, `output-dir: lib/l10n/gen`, `nullable-getter: false`, `synthetic-package: false`).
- C `lib/l10n/app_bn.arb`, `lib/l10n/app_en.arb` — seeded with the keys used by existing screens, prefixed per feature (`common_`, `auth_`, `home_`, `txn_`, `budget_`, `chat_`, `buzz_`, `sync_`, `settings_`, …). Plural/placeholder forms use ICU (`{count, plural, …}`).
- C `lib/core/l10n/locale_controller.dart` — `LocaleController extends StateNotifier<Locale>` persisting `bn|en` in `Meta('locale')`; provider `localeProvider`.
- M `lib/app/app.dart` (created in T-MOB-08) — `localizationsDelegates: AppLocalizations.localizationsDelegates`, `supportedLocales: [Locale('bn'), Locale('en')]`, `locale: ref.watch(localeProvider)`.
- C `tool/l10n_check.dart` — compares key sets of both ARB files, fails on missing keys, unused keys (grep `l10n.<key>` in `lib/`), and any English letters inside a `bn` value other than inside `{placeholders}`, brand names ("bKash", "Nagad", "Rocket", "TrxID", "OTP", "SMS", "CSV") .
**Steps** — 1. Add l10n config and ARB files. 2. `flutter gen-l10n`. 3. Add the extension `extension L10nX on BuildContext { AppLocalizations get l10n => AppLocalizations.of(this); }` in `lib/core/l10n/l10n_x.dart`. 4. Replace literal strings in every file still using them as each screen task replaces its screen (this task only converts `login_screen.dart`, `settings_screen.dart`, `dashboard_screen.dart` strings that remain until those screens are rewritten). 5. Add `tool/l10n_check.dart` to CI.
**Contract** — key naming `<feature>_<screen>_<purpose>` e.g. `auth_login_phoneLabel`.
**Tests** — `test/l10n/l10n_keys_test.dart`: runs the checker logic as a function; asserts zero differences; `locale_controller_test.dart`: switching to `en` rebuilds a probe widget with English text and persists after restart (fake `LocalStore`).
**Acceptance** — `cd apps/mobile && flutter gen-l10n && dart run tool/l10n_check.dart && flutter test test/l10n`
**Done when** — CI fails if a key exists in only one language or is unused.

### T-MOB-05 · `Money` value type and numeral formatting
- **Closes:** GAP-MOB-03, FR-VOICE-05 (display side), SRS §2.4, §5.1.2
- **Depends on:** T-MOB-01
- **Milestone:** M0
- **Layer:** mobile
**Why** — App state holds money as `double` (`addExpense(double taka)`); money must be integer paisa and display as `৳ ১,২৫,০০০` or `৳ 1,25,000` by user setting.
**Files**
- C `lib/core/money/money.dart` — `final class Money implements Comparable<Money> { final int paisa; const Money(this.paisa); factory Money.fromTaka(int taka); Money operator +/-; Money operator -(); bool get isNegative; static const zero; }` — no constructor from `double`.
- C `lib/core/money/money_format.dart` — `String formatMoney(Money m, {required NumeralStyle style, bool showSymbol = true, bool signed = false})` with South Asian grouping (last 3 digits, then pairs), no decimals when paisa % 100 == 0 else two decimals; `enum NumeralStyle { bangla, latin }`; `String toBanglaDigits(String)`.
- C `lib/core/money/parse_taka.dart` — `Money? parseTakaInput(String)` accepting Bangla or Latin digits, commas, optional `৳`.
- M `lib/presentation/providers/providers.dart` — `AppState` totals become `Money`; `addExpense(Money m, …)`, `addIncome(Money m, …)`; remove every `/ 100` and `* 100` conversion.
- M callers in `dashboard_screen.dart`, `transaction_screen.dart`, `ai_entry_screen.dart` (use `Money`).
- C `packages/shared/test-vectors/money.json` is created by backend task T-PLAT-18; until it exists, this task creates it with these vectors and T-PLAT-18 reuses it: `[{"paisa":85000,"bn":"৳ ৮৫০","en":"৳ 850"},{"paisa":12500000,"bn":"৳ ১,২৫,০০০","en":"৳ 1,25,000"},{"paisa":-234000,"bn":"−৳ ২,৩৪০","en":"−৳ 2,340"},{"paisa":150,"bn":"৳ ১.৫০","en":"৳ 1.50"},{"paisa":0,"bn":"৳ ০","en":"৳ 0"},{"paisa":100000000,"bn":"৳ ১০,০০,০০০","en":"৳ 10,00,000"}]`.
**Steps** — 1. Implement `Money` and formatting. 2. Load the vectors in a test. 3. Replace doubles. 4. Add a custom lint-style test `test/core/no_double_money_test.dart` that greps `lib/` for `double taka`, `/ 100`, `* 100)` near `paisa` and fails.
**Contract** — none.
**Tests** — `money_test.dart` (arithmetic, equality), `money_format_test.dart` (all vectors in both styles), `parse_taka_test.dart` ("৮৫০", "1,25,000", "৳ ৯৯", "abc" → null), `app_state_test.dart` updated.
**Acceptance** — `cd apps/mobile && flutter test test/core/money test/presentation/app_state_test.dart test/core/no_double_money_test.dart`
**Done when** — no `double` carries money anywhere in `lib/`.

### T-MOB-06 · Shared widget kit
- **Closes:** FR-A11Y-01, FR-A11Y-02, SRS §4.1.1 rules
- **Depends on:** T-MOB-02, T-MOB-03, T-MOB-04
- **Milestone:** M0
- **Layer:** mobile
**Why** — The 52 screens reuse the same few shapes: big pill buttons, icon tiles, avatars with presence, status chips, a listen button, a back header, a 5-tab bar.
**Files** (all in `lib/ui/`, one widget per file, each with a doc comment naming the design board it comes from)
- `big_button.dart` — `BigButton({required String label, required VoidCallback? onPressed, IconData? icon, BigButtonStyle style = primary|amber|outline|danger|quiet, double? height})`; height defaults to `UiScale` primary (56 or 72), full pill radius, label 18 sp bold; always renders `Semantics(button: true, label: label)`.
- `icon_tile.dart` — `IconTile` (rounded 22 dp, icon 30 + label 17 bold, heights 84/112) for Home tiles and Simple mode.
- `big_mic_button.dart` — `BigMicButton({required VoidCallback onPressed, bool listening, String label})` amber, 84 dp tall, 40 dp icon (Home) and `.huge` variant 104 dp circle (Ask, Simple mode).
- `listen_button.dart` — `ListenButton({required String text})` speaks via `voiceServiceProvider`, shows "শুনুন" with speaker icon, ≥ 56 dp, toggles to a stop state while speaking.
- `member_avatar.dart` — `MemberAvatar({required Member m, double size = 56, bool? online})` colour pair by `m.avatarIndex`, presence dot 16 dp with 3 dp ring and the word beside it when `showLabel`.
- `status_chip.dart` — `StatusChip({required StatusKind kind, required String label})` with kinds ok/warn/bad/neutral; always icon + text (FR-A11Y-02).
- `app_header.dart` — `AppHeader({required String title, bool back = true, List<Widget> actions})` 56 dp back button labelled "পেছনে", title 26 bold.
- `bottom_tabs.dart` — `AppBottomTabs({required int index, required ValueChanged<int> onSelect, int chatBadge = 0})`: 72 dp bar, items হোম, কথা, তালিকা, বাজেট, পরিবার with icons from the design (home, chat bubble, list, pie, people), selected colour green bold, unselected muted, red badge on কথা showing the Bangla digit count.
- `amount_text.dart` — `AmountText(Money m, {AmountStyle style})` using `formatMoney` with the user's numeral setting.
- `empty_state.dart` — `EmptyState({required IconData icon, required String message, String? actionLabel, VoidCallback? onAction, bool speakHint = true})`.
- `permission_explainer.dart` — bottom-sheet widget used by permission flows (T-MOB-72).
- `banner_strip.dart` — `BannerStrip({required BannerKind kind, required String text, String? actionLabel, VoidCallback? onAction})` (amber tint for warn, danger tint for error).
**Steps** — 1. Implement the widgets using tokens only. 2. Each widget exposes constants for its sizes so tests do not hardcode numbers. 3. Add `test/ui/widget_kit_test.dart`.
**Contract** — `UiScale` is read from `uiScaleProvider` (StateProvider, default normal; set by Simple mode, T-MOB-50).
**Tests** — `big_button_test.dart` (height 56 normal, 72 simple; semantics label equals `label`; disabled has no tap), `bottom_tabs_test.dart` (5 labels exactly "হোম", "কথা", "তালিকা", "বাজেট", "পরিবার"; badge text "২" when `chatBadge: 2`; each tab ≥ 48 dp wide), `status_chip_test.dart` (every kind has an icon and text), `member_avatar_test.dart` (online shows word "অনলাইন"), `amount_text_test.dart`.
**Acceptance** — `cd apps/mobile && flutter test test/ui`
**Done when** — all later screens import from `lib/ui/` and none define their own pill buttons.

### T-MOB-07 · Secure token storage and refresh rotation
- **Closes:** FR-AUTH-03, FR-AUTH-09, GAP-MOB-12
- **Depends on:** T-MOB-01 (backend: T-ID refresh rotation; develop against `FakeAuthApi`)
- **Milestone:** M1
- **Layer:** mobile
**Why** — Only an access token is stored, in plain `shared_preferences`; it expires in 15 minutes and the user is signed out.
**Files**
- M `pubspec.yaml` add `flutter_secure_storage ^9.2.2`.
- C `lib/data/auth/token_store.dart` — `abstract class TokenStore { Future<Tokens?> read(); Future<void> write(Tokens t); Future<void> clear(); }`, `SecureTokenStore` (keys `ap.access`, `ap.refresh`, `ap.deviceId`), `MemoryTokenStore` for tests; `class Tokens {String access; String refresh; DateTime accessExpiresAt;}`.
- C `lib/data/auth/session_manager.dart` — `SessionManager` holds tokens; `Future<String?> validAccessToken()` refreshes when < 60 s left, with a single in-flight refresh (`Completer`) so parallel calls share one `POST /v1/auth/refresh`; on 401 from refresh calls `onSessionExpired` and clears tokens; emits `Stream<SessionState>` (`signedOut | signedIn | expired`).
- M `lib/data/api/api_client.dart` — split into `ApiTransport` (adds `Authorization`, retries once after a refresh on 401, maps `{error:{code,message,details}}` to `ApiException(status, code, message, details)`) and typed API classes (done in T-MOB-10); `ApiException` gains `code` and `details`.
- M `lib/presentation/providers/auth_provider.dart` — `AuthNotifier` uses `SessionManager`; replaces `SharedPreferences` token code; keeps `restore()`.
- M `android/app/src/main/AndroidManifest.xml` — `android:allowBackup="false"` on `<application>` so tokens are not restored from backup.
**Steps** — 1. Implement store and manager with injectable clock. 2. Move retry logic into transport. 3. Migrate: on first run, if `shared_preferences` has `amar-poribar.token`, delete it and show F6 (old tokens have no refresh token). 4. Expose `sessionStateProvider` for the router guard (T-MOB-08).
**Contract** — refresh: `POST /v1/auth/refresh {refreshToken}` → `{accessToken, refreshToken, expiresIn}`; error codes used: `unauthorized`, `session_revoked`.
**Tests** — `test/data/auth/session_manager_test.dart`: refresh only when near expiry; ten parallel calls cause one refresh request; refresh 401 → `expired` and tokens cleared; reuse error `session_revoked` → `expired`; `api_transport_test.dart`: a 401 with valid refresh retries the original request once and succeeds; a second 401 surfaces.
**Acceptance** — `cd apps/mobile && flutter test test/data/auth test/data/api_client_test.dart`
**Done when** — tokens never touch `shared_preferences`; killing the app and reopening keeps the session until the refresh token itself expires.

### T-MOB-08 · `go_router` shell, five tabs, guards, deep links
- **Closes:** FR-NAV-01, GAP-MOB-01, FR-FAM-02 (deep link), FR-NUDGE-03 (deep link target)
- **Depends on:** T-MOB-04, T-MOB-06, T-MOB-07
- **Milestone:** M1
- **Layer:** mobile
**Why** — Navigation is a `Navigator 1.0` switch with no tabs and no deep links; invite links, buzz taps and incoming calls need URLs.
**Files**
- M `pubspec.yaml` add `go_router ^14.6.0`.
- C `lib/app/app.dart` — `AmarPoribarApp` (`MaterialApp.router`, themes, locale, `routerConfig`).
- C `lib/app/router.dart` — `final routerProvider = Provider<GoRouter>(…)`, route constants class `Routes`:
  `/welcome`, `/login`, `/login/code`, `/consent`, `/join/:token`, `/tutorial`, `/session-expired`;
  shell (StatefulShellRoute.indexedStack with five branches): `/home`, `/talk`, `/list`, `/budget`, `/family`;
  pushed: `/buzz` (extra: recipients), `/buzz/incoming/:nudgeId`, `/talk/:conversationId`, `/voice-note/:conversationId`, `/call/:callId`, `/add`, `/txn/:id`, `/receipt`, `/rule-learn`, `/voice-fallback`, `/summary`, `/ask`, `/settings`, `/profile`, `/accounts`, `/categories`, `/recurring`, `/festival/new`, `/reports`, `/remit`, `/plans`, `/dhar`, `/families`, `/notifications`, `/sync`, `/bazaar`, `/delete-account`, `/simple`.
  Every route not yet implemented points to `PlaceholderScreen(routeName)` (a visible "শীঘ্রই আসছে" page) so the shell is complete from day one; each screen task replaces its placeholder.
- C `lib/app/shell.dart` — `AppShell` with `AppBottomTabs` bound to `StatefulNavigationShell`, `chatBadge` from `totalUnreadProvider` (returns 0 until T-MOB-37).
- C `lib/app/redirects.dart` — `String? redirect(Ref, GoRouterState)`: signed out → `/welcome` if `Meta('welcome_done')` missing else `/login`; signed in without family → `/consent`; session `expired` → `/session-expired?from=<encoded location>`; deep link `/join/:token` is always allowed.
- M `lib/main.dart` — `runApp(ProviderScope(child: AmarPoribarApp()))`; initial location from the redirect.
- D `lib/presentation/navigation/app_router.dart`.
- M `android/app/src/main/AndroidManifest.xml` — intent filters on `MainActivity`: `https://amarporibar.app/join/*` (autoVerify), custom scheme `amarporibar://join/*`, `amarporibar://buzz/*`, `amarporibar://call/*`.
**Steps** — 1. Build the router with the shell. 2. Port the existing screens as pushed routes pointing at old widgets temporarily (`/settings` → `SettingsScreen`, `/tutorial` → `TutorialScreen`, `AiEntryScreen` as `/add` until T-MOB-26/28 land) so the app stays runnable. 3. Replace every `Navigator.pushNamed/pushReplacementNamed` with `context.go/push`. 4. Add `deepLinkProvider` that feeds notification taps (T-MOB-34) into `router.go`.
**Contract** — URL parameters are opaque ids; unknown ids show `ErrorScreen` ("এটি খুঁজে পাওয়া যায়নি" + button "হোমে যান").
**Tests** — `test/app/router_test.dart`: signed out → `/welcome`; after sign-in and family → `/home`; `amarporibar://join/abc` while signed out lands on `/join/abc` then, after login, resumes it; expired session redirects with the `from` query and returns after login; tab switch keeps each tab's scroll state (stateful shell); back from a pushed route returns to its tab. `test/app/shell_test.dart`: five tab labels exact, badge shows "২" when `totalUnreadProvider` overridden to 2.
**Acceptance** — `cd apps/mobile && flutter test test/app && flutter analyze`
**Done when** — `rg "Navigator\.(push|pop)Named|MaterialPageRoute" apps/mobile/lib` returns nothing outside generated code.

### T-MOB-09 · Remove placeholder `Role`/budget state; real family and member state
- **Closes:** GAP-MOB-02, FR-FAM-03 (data), FR-FAM-05
- **Depends on:** T-MOB-05, T-MOB-08, T-MOB-11
- **Milestone:** M1
- **Layer:** mobile
**Why** — `Role {father,mother,child}` and `monthlyBudget = 100000` are fake; server roles are owner/admin/member/viewer.
**Files**
- D `lib/domain/models/enums.dart` `Role` enum; C `lib/domain/models/role.dart` — `enum FamilyRole { owner, admin, member, viewer }` with `fromWire`, `rank`, and `bool get canManageMembers`, `canEditAll`, `canWriteLedger` (viewer false).
- C `lib/domain/models/member.dart` — `Member {String userId; String name; FamilyRole role; String phoneLast3; int avatarIndex; bool online; DateTime? lastSeen;}`.
- C `lib/features/family/data/family_repository.dart` (interface: `Stream<List<Member>> watchMembers(String familyId)`, `Future<FamilyInfo> current()`, `Future<void> refresh(String familyId)`), `fake_family_repository.dart` (the five people of the design: আব্বু owner (me), আম্মু admin, দাদি member, তানভীর viewer; plus pending invite ০১৭৯৮ ৭৬৫ ৪৩২), `api_family_repository.dart` (reads `GET /v1/families/:id/members`, caches into `CachedMembers`).
- M `lib/presentation/providers/providers.dart` — delete `AppState.activeRole` and `monthlyBudget`; `AppStateNotifier` becomes `MonthTotalsNotifier` reading `Money` totals only; budgets come from `budgetRepositoryProvider` (T-MOB-32).
- M `lib/presentation/screens/dashboard_screen.dart`, `onboarding_screen.dart`, `settings_screen.dart` — remove `Role` usage; the onboarding screen is deleted by T-MOB-19.
- M `lib/domain/models/user_device.dart`, `bank_message.dart` — delete if unused after this task (`rg` check).
**Steps** — 1. Add the new models and repository. 2. Introduce `currentRoleProvider` (derived from members + my user id from `MeResponse`). 3. Remove old enum and fix compile errors. 4. Add `meProvider` (`GET /v1/me`).
**Contract** — `GET /v1/me` → `{id, phone, name, locale, bnDigits, simpleMode, reminderTime, hidePresence, families:[{id,name,role}]}` (fields added by T-ID).
**Tests** — `test/features/family/family_repository_test.dart` (fake emits members; role ranks), `test/domain/role_test.dart` (permissions per role), `app_state_test.dart` updated.
**Acceptance** — `cd apps/mobile && flutter test test/features/family test/domain test/presentation/app_state_test.dart && ! rg -n "Role\\.father|monthlyBudget" lib`
**Done when** — no hard-coded roles or budget amounts remain.

### T-MOB-10 · API client split, typed models, OpenAPI contract test
- **Closes:** GAP-ARCH-07, GAP-MOB-14, DEC-17
- **Depends on:** T-MOB-07, T-PLAT-17 (OpenAPI generation) — until it exists, the test reads a hand-copied `test/contract/openapi.snapshot.json`
- **Milestone:** M0
- **Layer:** mobile
**Why** — The client is one 265-line file that mirrors the API by hand; drift is invisible.
**Files**
- M `lib/data/api/api_client.dart` → split into `lib/data/api/{api_transport,auth_api,family_api,ledger_api,ai_api,budget_api,report_api,sync_api,comms_api,notification_api,shopping_api,lending_api,billing_api,privacy_api}.dart`; each is a thin class over `ApiTransport` with typed methods returning models from `lib/domain/models/api/*.dart` (`json_serializable` is already available; use `@JsonSerializable(explicitToJson: true)`).
- C `lib/data/api/api_providers.dart` — one provider per API class.
- C `test/contract/openapi_contract_test.dart` — loads `../../apps/api/openapi.json` (path `../api/openapi.json` relative to `apps/mobile`), loads every `packages/shared/test-vectors/api/<operationId>.<case>.json` fixture, and for each operation validates the fixture against the response schema with `json_schema`, then decodes it with the matching Dart model and re-encodes it; fails when a required property is missing in the model or a model field has no schema property.
- C `test/contract/fixtures/` — copies of vectors until `packages/shared/test-vectors/api` exists (T-PLAT-17); a `tool/sync_fixtures.dart` copies them and CI runs it before the test.
- M `.github/workflows/ci.yml` — mobile job runs `dart run tool/sync_fixtures.dart` first.
**Steps** — 1. Move methods one API class at a time keeping signatures so screens compile. 2. Add models for every response in SRS §5.2 that mobile uses (list in the task PR: Me, Family, Member, Account, Category, Transaction, Draft, Budget, FestivalBudget, Recurring, Summary, Report, SyncRequest/Response, Conversation, Message, Nudge, PhraseCatalogue, IceServers, InboxItem, Preferences, ShoppingList/Item, Dhar, Plan/Subscription/Invoice, PrivacyRequest). 3. Write the contract test. 4. Keep `ApiException` mapping in transport.
**Contract** — error body `{error:{code,message,details?}}`; list responses `{items,nextCursor}`.
**Tests** — the contract test above; `test/data/api/*_api_test.dart` using `http.testing.MockClient` for URL, method, body, and error mapping per class.
**Acceptance** — `cd apps/mobile && dart run tool/sync_fixtures.dart && flutter test test/contract test/data/api`
**Done when** — adding a required field in the OpenAPI document without updating the Dart model fails CI.

### T-MOB-11 · Local database v4: reference data cache (budgets, members, entitlements, balances)
- **Closes:** FR-SYNC-08, GAP-MOB-08 (part 1)
- **Depends on:** T-MOB-01
- **Milestone:** M1
- **Layer:** mobile
**Why** — Screens must work offline with budgets, members, plan limits and account balances.
**Files**
- M `lib/data/database/tables.dart` — add tables:
```
class CachedBudgets extends Table {            // read-only copy of GET /budgets
  TextColumn get id => text()();
  TextColumn get familyId => text()();
  TextColumn get categoryId => text().nullable()();   // null = overall
  TextColumn get month => text()();                   // YYYY-MM
  IntColumn get limitPaisa => integer()();
  IntColumn get spentPaisa => integer().withDefault(const Constant(0))();
  TextColumn get level => text().withDefault(const Constant('ok'))(); // ok|warning|exceeded
  @override Set<Column> get primaryKey => {id};
}
class CachedMembers extends Table {
  TextColumn get userId => text()(); TextColumn get familyId => text()();
  TextColumn get name => text()(); TextColumn get role => text()();
  TextColumn get phoneLast3 => text().withDefault(const Constant(''))();
  IntColumn get avatarIndex => integer().withDefault(const Constant(0))();
  @override Set<Column> get primaryKey => {userId, familyId};
}
class CachedEntitlements extends Table {       // one row per family
  TextColumn get familyId => text()(); TextColumn get planCode => text()();
  IntColumn get memberLimit => integer()(); IntColumn get aiQuotaMonth => integer()();
  IntColumn get aiUsedMonth => integer().withDefault(const Constant(0))();
  IntColumn get historyMonths => integer().nullable()();
  TextColumn get flagsJson => text().withDefault(const Constant('{}'))();
  @override Set<Column> get primaryKey => {familyId};
}
```
  and add columns to `CachedAccounts`: `balancePaisa` (int, default 0), `ownerUserId` (text nullable), `archived` (bool, default false), `openingBalancePaisa` (int, default 0); to `CachedCategories` nothing.
- M `lib/data/database/database.dart` — `schemaVersion => 4`; `onUpgrade`: `if (from < 4) { await m.createTable(cachedBudgets); await m.createTable(cachedMembers); await m.createTable(cachedEntitlements); await m.addColumn(cachedAccounts, cachedAccounts.balancePaisa); …addColumn for ownerUserId, archived, openingBalancePaisa; }`.
- M `lib/data/database/local_store.dart` — methods `replaceBudgets(familyId, rows)`, `watchBudgets(familyId, month)`, `replaceMembers`, `watchMembers`, `replaceEntitlements`, `entitlements(familyId)`, extended `replaceAccounts` (keeps archived flag), `watchAccounts`.
- C `lib/data/sync/reference_data_sync.dart` — `ReferenceDataSync(api, store).refresh(familyId)` fetching categories, accounts (with balances), budgets for the current and previous month, members and `GET /v1/families/:id/subscription` (entitlements) in parallel; any single failure leaves the old cache and is reported in `SyncSummary.referenceErrors`.
- M `lib/data/sync/sync_service.dart` — call `ReferenceDataSync.refresh` after a successful ledger sync (FR-SYNC-08).
**Steps** — 1. Add tables. 2. Bump version with migration. 3. Add store methods using Drift streams. 4. Implement `ReferenceDataSync`. 5. Regenerate (`dart run build_runner build`).
**Contract** — budgets `{id, categoryId, month, limitPaisa, spentPaisa, level}`; members `{userId,name,role,phoneLast3}`; entitlements `{planCode,memberLimit,aiQuotaMonth,aiUsedMonth,historyMonths,flags}`.
**Tests** — `test/data/database/migration_v3_to_v4_test.dart` (open a v3 database file built from the old schema via `drift_dev` schema dump `drift_schemas/v3.json`, upgrade, rows intact, new tables empty); `local_store_reference_test.dart` (replace is atomic; watch emits on change); `reference_data_sync_test.dart` (one failing endpoint keeps old data).
**Acceptance** — `cd apps/mobile && dart run drift_dev schema dump lib/data/database/database.dart drift_schemas/ && flutter test test/data/database test/data/sync`
**Done when** — `drift_schemas/` contains `drift_schema_v3.json` and `v4.json`, and migration tests pass (the same pattern is used for every later bump).

### T-MOB-12 · Active family and multi-family session state
- **Closes:** FR-FAM-04 (state), GAP-MOB-13 (part)
- **Depends on:** T-MOB-09, T-MOB-11
- **Milestone:** M1
- **Layer:** mobile
**Why** — The app uses `families.first`; a user may belong to several families.
**Files** — C `lib/features/family/state/active_family.dart` — `activeFamilyIdProvider` (StateNotifier persisting in `Meta('active_family')`), `activeFamilyProvider` (resolved `FamilyInfo`), `familiesProvider`; M `auth_provider.dart` (`AuthState.family` replaced by `activeFamilyProvider`); M every provider that took `family.id` to read `activeFamilyIdProvider`; C `lib/features/family/data/family_list_repository.dart`.
**Steps** — 1. On sign-in call `GET /v1/me`; choose the stored active id if still a member, else the first. 2. Changing the active family clears family-scoped state (`ref.invalidate` of a `familyScoped` provider group defined in `lib/app/family_scope.dart`). 3. Local DB rows are filtered by `familyId` everywhere (Transactions already family-agnostic per device: add `familyId` column in T-MOB-24).
**Contract** — none new.
**Tests** — `test/features/family/active_family_test.dart`: remembers choice; removed membership falls back; switching invalidates budgets provider.
**Acceptance** — `cd apps/mobile && flutter test test/features/family/active_family_test.dart`
**Done when** — no code reads `families.first`.

### T-MOB-13 · App bootstrap and the `pumpApp` test harness
- **Closes:** NFR-11, enables every screen task's tests
- **Depends on:** T-MOB-02, T-MOB-04, T-MOB-08
- **Milestone:** M1
- **Layer:** mobile
**Why** — Screen tasks all need the same setup (theme, l10n, router, fake repositories, in-memory database). One helper keeps them short and consistent.
**Files**
- C `lib/app/bootstrap.dart` — `Future<ProviderContainerOverrides> bootstrap()` opens the Drift database, `LocalStore`, `SecureTokenStore`, initialises Firebase (guarded: skipped when `google-services.json` is absent so debug builds without Firebase still run), returns overrides for `localStoreProvider`, `tokenStoreProvider`.
- M `lib/main.dart` — `WidgetsFlutterBinding.ensureInitialized(); final overrides = await bootstrap(); runApp(ProviderScope(overrides: overrides, child: const AmarPoribarApp()));`.
- C `test/helpers/pump_app.dart` — `Future<void> pumpApp(WidgetTester t, Widget screen, {List<Override> overrides = const [], Locale locale = const Locale('bn'), UiScale scale = UiScale.normal, bool dark = false, Size size = const Size(390, 844)})` wrapping in `ProviderScope(overrides: [...defaultFakes, ...overrides])`, `MaterialApp` with themes, localisation delegates and `locale`, sets `t.view.physicalSize` to `size` with `devicePixelRatio = 1`.
- C `test/helpers/fakes.dart` — `defaultFakes` list: in-memory `LocalStore` (`AppDatabase.memory()`), `MemoryTokenStore`, `FakeVoiceService` (records `spoken`, scripted `listen` results), `FakeClock`, all `Fake<Feature>Repository` providers (each screen task adds its fake here in one line).
- C `test/helpers/fake_voice_service.dart`.
**Steps** — 1. Write helper and fakes. 2. Convert the three existing widget tests (`ai_entry_voice_test.dart`, `tutorial_test.dart`, `app_state_test.dart`) to use it. 3. Document usage at the top of the helper file.
**Contract** — none.
**Tests** — `test/helpers/pump_app_test.dart`: a probe widget reads `context.l10n`, the theme's primary button height and the screen size; asserts 390×844 and Bangla text.
**Acceptance** — `cd apps/mobile && flutter test test/helpers test/presentation`
**Done when** — no test builds its own `MaterialApp`.

---

## M1 · Sign-in and onboarding screens

### T-MOB-14 · A1 Login with phone and OTP *(screen)*
- **Closes:** FR-AUTH-01, -02, -08 (client), AC-12 (client part)
- **Depends on:** T-MOB-06, T-MOB-07, T-MOB-08, T-MOB-13
- **Milestone:** M1
- **Layer:** mobile
**Why** — First screen a returning user sees; must be usable by someone who reads slowly.
**Files**
- C `lib/features/auth/data/auth_repository.dart` — `abstract class AuthRepository { Future<OtpChallenge> requestOtp(String phone); Future<Tokens> verifyOtp(String phone, String code); }`; `OtpChallenge {int resendAfterSeconds; int attemptsLeft; String? devCode;}`; `fake_auth_repository.dart` (accepts code `123456`, fails with scripted `OtpError`s); `api_auth_repository.dart` (uses `AuthApi`).
- C `lib/features/auth/state/login_controller.dart` — `LoginController` (`StateNotifier<LoginState>`): fields `phone`, `code`, `phase` (`phone|code`), `busy`, `error` (typed `OtpFailure`), `resendSecondsLeft`; methods `submitPhone()`, `submitCode()`, `resend()`, `changeNumber()`.
- C `lib/features/auth/ui/login_screen.dart` — `LoginScreen`; route `/login` (phone step) and `/login/code` (code step, same widget with `phase`).
- D `lib/presentation/screens/login_screen.dart`.
- M `lib/l10n/app_bn.arb`/`app_en.arb` — keys `auth_login_title` "আমার পরিবার", `auth_login_tagline` "পরিবারের সব হিসাব, এক জায়গায়", `auth_login_phoneLabel` "আপনার মোবাইল নম্বর দিন", `auth_login_phoneHint` "আমরা একটি ৬ সংখ্যার কোড এসএমএসে পাঠাব।", `auth_login_codeLabel` "কোডটি লিখুন", `auth_login_resend` "আবার পাঠান ({time})", `auth_login_resendQuestion` "কোড আসেনি?", `auth_login_submit` "ঢুকুন", `auth_login_helpFooter` "সাহায্য লাগলে বাড়ির কাউকে ফোন দিন।".
**Steps** — 1. Layout from `Login.dc.html`: logo tile 84×84 radius 28 green with white home icon; title 34 bold green; tagline 17 muted; label 20 semibold; phone field 68 dp, 3 dp green border, prefix "+৮৮", 26 sp semibold digits; six code boxes each 64 dp tall, radius 16, 2 dp green border when filled (28 sp bold), amber 3 dp border on the active box; resend row "কোড আসেনি? **আবার পাঠান (০:৪২)**"; primary button 72 dp full pill "ঢুকুন"; footer 14 sp muted centred. 2. Use a single hidden `TextField` (numeric, `autofillHints: [AutofillHints.oneTimeCode]`, max 6) driving the six boxes so SMS autofill works. 3. Accept Bangla digits typed or pasted (`toLatinDigits`), validate `^(?:\+?88)?01[3-9]\d{8}$` locally before calling the API; invalid → inline message `auth_login_phoneInvalid` "নম্বরটি ঠিক নয়। ০১ দিয়ে শুরু করে ১১ সংখ্যা লিখুন।". 4. The countdown is driven by the `resendAfterSeconds` from the server, formatted with the numeral setting. 5. On success: store tokens (T-MOB-07), call `GET /v1/me`, route per redirect rules (T-MOB-08). 6. Error handling is T-MOB-15.
**Contract** — `POST /v1/auth/otp/request {phone}` → `{sent:true, resendAfterSeconds, devCode?}`; `POST /v1/auth/otp/verify {phone, code}` → tokens; errors `otp_invalid{attemptsLeft}`, `otp_expired`, `otp_rate_limited{retryAfterSeconds}`.
**Tests** — `test/features/auth/login_screen_test.dart`: phone step shows exact Bangla labels; Latin and Bangla digit input both accepted; invalid number shows the message and makes no API call; valid number → code step with resend timer counting down using `FakeClock`; code `123456` signs in and navigates to `/home`; semantics: field labelled "মোবাইল নম্বর", code field "৬ সংখ্যার কোড", submit "ঢুকুন", every tappable ≥ 48 dp and the submit ≥ 72 dp; golden `test/goldens/A1_login.png` (phone step) and `A1_login_code.png`.
**Acceptance** — standard (see R-SCREEN item 7) with `test/features/auth` and `test/goldens/A1_*`.
**Done when** — screen matches `Login.dc.html` within 2% and signs in against the fake.

### T-MOB-15 · A7 Wrong or expired code, lockouts *(screen state)*
- **Closes:** FR-AUTH-07, AC-12
- **Depends on:** T-MOB-14
- **Milestone:** M1
- **Layer:** mobile
**Why** — A wrong code must never feel like a dead end.
**Files** — M `lib/features/auth/ui/login_screen.dart` (error panel), C `lib/features/auth/ui/otp_error_panel.dart`, C `lib/features/auth/domain/otp_failure.dart` (sealed `OtpFailure`: `Invalid(attemptsLeft)`, `Expired`, `RateLimited(retryAfter)`, `Network`, `Server`), M ARB: `auth_otp_wrongTitle` "কোডটি মেলেনি", `auth_otp_wrongBody` "আবার দেখে লিখুন। আর {count} বার চেষ্টা করতে পারবেন।", `auth_otp_newCode` "নতুন কোড পাঠান", `auth_otp_wrongNumber` "নম্বর ভুল? বদলান", `auth_otp_helpTitle` "কোড না এলে:", `auth_otp_helpBody` "একটু অপেক্ষা করুন। এরপরও না এলে বাড়ির কাউকে ফোন দিন। কোড কাউকে বলবেন না।", `auth_otp_limitNote` "এক ঘণ্টায় সর্বোচ্চ ৫ বার কোড চাওয়া যায়। এ নম্বরে {count} বার চাওয়া হয়েছে।", `auth_otp_expiredTitle` "কোডের সময় শেষ", `auth_otp_expiredBody` "নতুন কোড নিন।", `auth_otp_rateLimited` "অনেকবার চেষ্টা হয়েছে। {time} পরে আবার চেষ্টা করুন।", `auth_otp_serverDown` "এখন সংযোগ হচ্ছে না। একটু পরে আবার চেষ্টা করুন।".
**Steps** — 1. Map `ApiException.code` to `OtpFailure`. 2. Red state per `OtpError.dc.html`: all six boxes 3 dp `danger` border; panel `dangerTint` radius 18 with a 30 dp error icon (circle with "!"), title 18 bold in `dangerInk`, body 15; "নতুন কোড পাঠান" outlined 64 dp pill, 3 dp green border; "নম্বর ভুল? বদলান" text button 56 dp underlined; help card white with border; the disabled "ঢুকুন" button (`#C9BBA3` background, `#4A3C2C` text) while `attemptsLeft == 0` or a lockout runs. 3. `RateLimited` shows a live countdown and disables resend. 4. Speak the error title and body through the voice service when Simple mode is on (hook, no-op until T-MOB-50). 5. After 5 wrong tries (`attemptsLeft == 0`) the code input clears and focus returns to resend.
**Contract** — see T-MOB-14.
**Tests** — `test/features/auth/otp_error_test.dart`: invalid(4) shows "আর ৪ বার" with Bangla digits when numeral style is Bangla and "4" when Latin; expired shows new-code button only; rate-limited disables submit and shows countdown; changing the number returns to phone step with the number kept; golden `A7_otp_error.png`.
**Acceptance** — standard with `test/features/auth/otp_error_test.dart`, `test/goldens/A7_*`.
**Done when** — all five failures have distinct Bangla text and a next step.

### T-MOB-16 · F6 Session expired and invite expired *(screen)*
- **Closes:** FR-AUTH-09, FR-ONB-03
- **Depends on:** T-MOB-07, T-MOB-08, T-MOB-14
- **Milestone:** M1
- **Layer:** mobile
**Why** — When the refresh token fails, the user must return to the same place after logging in, with local data kept.
**Files** — C `lib/features/auth/ui/session_expired_screen.dart` (route `/session-expired?from=`), C `lib/features/auth/ui/invite_expired_card.dart` (used by T-MOB-18 for expired/used links); strings from `SessionExpired.dc.html`: read the board and add the exact Bangla to ARB with keys `auth_expired_*` and `auth_inviteExpired_*` (title, body, primary button "আবার ঢুকুন", for invite "আব্বুকে কম্পন দিন" shown only when the inviter's name is known).
**Steps** — 1. Layout per the board: two friendly stacked cards, no blame wording, one big button each. 2. "আবার ঢুকুন" clears tokens but **keeps the local database**, navigates to `/login?from=<encoded>`; after sign-in the router returns to `from` if the same user id signs in, else `/home`. 3. If a different phone number signs in, ask before keeping local data: dialog `auth_expired_otherUser` "এটি অন্য নম্বর। এই ফোনের আগের তথ্য মুছে ফেলব?" with two big buttons; "না" returns to login. 4. Local DB rows are tagged with `userId` in `Meta('db_owner')`.
**Contract** — none.
**Tests** — `test/features/auth/session_expired_test.dart`: expired session redirects here with `from`; sign-in returns to `from`; local transactions still present; other number triggers the dialog; golden `F6_session_expired.png`.
**Acceptance** — standard.
**Done when** — AC-13 client part passes: reuse error → F6 → login → same screen.

### T-MOB-17 · A2 Consent and create family *(screen)*
- **Closes:** FR-AUTH-10, FR-FAM-01, FR-ONB-01, FR-PRIV-01, FR-PRIV-02
- **Depends on:** T-MOB-14, T-MOB-12
- **Milestone:** M1
- **Layer:** mobile
**Why** — Explicit PDPO consent before any data leaves the phone, then the family.
**Files** — C `lib/features/onboarding/data/onboarding_repository.dart` (`Future<PolicyDoc> policy(Locale)`, `Future<void> acceptConsent(String version, Locale)`, `Future<FamilyInfo> createFamily(String name)`), fake + API implementations (`GET /v1/policy`, `POST /v1/me/consents`, `POST /v1/families`), C `lib/features/onboarding/ui/consent_screen.dart` (route `/consent`), C `lib/features/onboarding/ui/policy_screen.dart` (full policy text, scrollable, route `/consent/policy`, "শুনুন" button reading it), ARB `onb_consent_*` from `Consent.dc.html`: title "আপনার পরিবার তৈরি করুন", "ধাপ ১ / ২", "পরিবারের নাম" (default hint "রহিম পরিবার"), "টাকার ধরন" with "৳ বাংলাদেশি টাকা (BDT)", "আপনার তথ্য কীভাবে ব্যবহার হবে" and its three bullets ("শুধু আপনার পরিবারের সদস্যরা হিসাব দেখবে।", "কথা আপনার ফোনেই লেখা হয়। রেকর্ড সার্ভারে যায় না।", "এআই-এর জন্য ফোন নম্বর ও অ্যাকাউন্ট নম্বর পাঠানো হয় না। যেকোনো সময় তথ্য মুছে দিতে পারবেন।"), "আমি রাজি আছি", "গোপনীয়তা নীতি", "পরিবার তৈরি করুন".
**Steps** — 1. Checkbox is a 40×40 green rounded square with a white check, labelled; the submit button stays disabled (greyed, not hidden) until checked and the name has ≥ 2 characters. 2. Order: `acceptConsent(policy.version)` then `createFamily(name)`; if the second fails keep consent and retry only the family. 3. Version is the string from `/v1/policy`; if it differs from the stored `Meta('consent_version')` on app start the router sends the user here again (redirect rule in T-MOB-08 reads `consentCurrentProvider`). 4. Step 2 of 2 is the optional tutorial prompt (routes to `/tutorial` or `/home`); show "ধাপ ২ / ২" with buttons "শুনে নিই" and "এখন নয়".
**Contract** — policy `{version, locale, title, body}`; consent body `{kind:"privacy", version, locale}`.
**Tests** — `consent_screen_test.dart`: button disabled until checkbox + name; consent called once even when family create fails then retried; version mismatch redirect; golden `A2_consent.png`.
**Acceptance** — standard.
**Done when** — a new user cannot reach `/home` without a stored consent for the current version.

### T-MOB-18 · A6 Join by invite link and F6 invite-expired state *(screen)*
- **Closes:** FR-FAM-02, FR-FAM-06 (client), FR-ONB-03
- **Depends on:** T-MOB-08, T-MOB-14, T-MOB-16
- **Milestone:** M1
- **Layer:** mobile
**Why** — Family members join from an SMS link or a push.
**Files** — C `lib/features/family/data/invite_repository.dart` (`Future<InvitePreview> preview(String token)`, `Future<FamilyInfo> accept(String token)`), fake + API (`GET /v1/invites/:token`, `POST /v1/invites/:token/accept`), C `lib/features/family/ui/join_screen.dart` (route `/join/:token`), ARB `fam_join_*` from `Join.dc.html`: "{inviter} আপনাকে ডেকেছেন", "{members} জন সদস্য · আপনি হবেন {role}", "যোগ দিলে আপনি পারবেন", bullets ("খরচ লিখতে ও দেখতে", "পরিবারের সাথে কথা বলতে", "ব্যক্তিগত খরচ শুধু নিজে দেখতে"), "আমন্ত্রণের মেয়াদ আছে আর {days} দিন।", "যোগ দিন", "এখন নয়".
**Steps** — 1. Three overlapping 72 dp avatars (−16 dp overlap) with 4 dp background ring; family name 32 bold green; summary line 16 muted; white card radius 22 with the three bullet rows (26 dp green icons); primary 76 dp "যোগ দিন"; quiet "এখন নয়" text button. 2. Viewer role bullets differ: viewer sees "পরিবারের হিসাব দেখতে (শুধু সারাংশ)" instead of the first bullet. 3. Errors from preview: `invite_expired`, `invite_used` → `InviteExpiredCard` (T-MOB-16); `invite_not_for_you` (phone-bound invite and a different number) → message `fam_join_wrongNumber` "এই আমন্ত্রণ অন্য নম্বরের জন্য।". 4. Not signed in: the screen stores the token in `Meta('pending_invite')`, goes to `/login`, and the redirect resumes the join after sign-in; if the user has no family afterwards the consent screen is skipped for the "create family" step (they join instead). 5. Accepting refreshes members and active family (T-MOB-12) and goes to `/home`.
**Contract** — preview `{familyName, inviterName, role, memberCount, expiresAt}`.
**Tests** — `join_screen_test.dart`: preview rendering with Bangla digits; accept → `/home` and active family set; expired → card; signed-out flow stores and resumes the token; deep link `amarporibar://join/abc` opens it; golden `A6_join.png`.
**Acceptance** — standard.
**Done when** — tapping an invite link on a fresh install leads, after login, to the family home.

### T-MOB-19 · D1 Welcome: language, numerals, Simple mode *(screen)*
- **Closes:** FR-ONB-01, FR-AUTH-04 (first-run part), FR-VOICE-09 (toggle)
- **Depends on:** T-MOB-04, T-MOB-05, T-MOB-06, T-MOB-08
- **Milestone:** M1
- **Layer:** mobile
**Why** — The first screen lets a person pick how the app speaks and looks before login.
**Files** — C `lib/features/onboarding/ui/welcome_screen.dart` (route `/welcome`); C `lib/features/settings/state/preferences_controller.dart` (`PreferencesController`: `locale`, `numeralStyle`, `simpleMode`, `reminderTime`, `hidePresence`, persisted in `Meta` keys `pref_*` and pushed to the server when signed in); D `lib/presentation/screens/onboarding_screen.dart`; ARB keys `onb_welcome_*` — read `Welcome.dc.html` and copy its exact Bangla (language chips বাংলা / English, numeral chips ১২৩ / 123, "সহজ মোড" with its one-line explanation, continue button).
**Steps** — 1. Changing language or numerals updates the preview text instantly (rebuild with the new locale). 2. Toggle "সহজ মোড" sets `uiScaleProvider` to `simple` immediately so the rest of the welcome screen already grows. 3. "এগিয়ে যান" saves `Meta('welcome_done')=1` and goes to `/login`. 4. Speak the screen's headline once on first show when Simple mode is toggled on (uses `voiceServiceProvider`).
**Contract** — preference values: `locale` `bn|en`; `numeralStyle` `bangla|latin`; `simpleMode` bool.
**Tests** — `welcome_screen_test.dart`: choosing English changes labels to English and persists; numerals chips change an amount sample; simple toggle changes the continue button height 56 → 72 in the same test; golden `D1_welcome.png` and `D1_welcome_simple.png`.
**Acceptance** — standard.
**Done when** — a first-run user finishes this screen with preferences stored and applied.

### T-MOB-20 · F8 Profile and preferences *(screen)*
- **Closes:** FR-AUTH-04, FR-PRES-02, FR-NOT-02 (time setting)
- **Depends on:** T-MOB-19, T-MOB-09
- **Milestone:** M1
- **Layer:** mobile
**Why** — Name, language, numerals, Simple mode, reminder time and presence in one place.
**Files** — C `lib/features/settings/ui/profile_screen.dart` (route `/profile`); C `lib/features/settings/data/profile_repository.dart` (`Future<Me> load()`, `Future<Me> update(ProfilePatch)` → `PATCH /v1/me`); ARB `profile_*` from `Profile.dc.html`.
**Steps** — 1. Avatar circle 96 dp (initial letter) with name edit field (large, 56 dp). 2. Rows: language chips, numerals chips, Simple mode switch (56 × 32 track, label + one-line explanation), daily reminder time (opens a time picker with big hour/minute dials; stored as `HH:mm` Asia/Dhaka; "রাত ৯:০০" shown in words per numeral style), "আমার অবস্থা লুকাই" presence switch with explanation. 3. Links: "গোপনীয়তা নীতি" → `/consent/policy`, "আমার তথ্য মুছুন" → `/delete-account`. 4. Optimistic update with rollback on error; changes while offline are queued in `Meta('profile_patch')` and flushed by sync (T-MOB-48). 5. Changing language triggers `localeProvider`.
**Contract** — `PATCH /v1/me {name?, locale?, bnDigits?, simpleMode?, reminderTime?, hidePresence?}`.
**Tests** — `profile_screen_test.dart`: edits call the repository with only changed fields; offline edit is queued and applied later; presence switch label; golden `F8_profile.png`.
**Acceptance** — standard.
**Done when** — a preference change survives restart and appears on a second device after sync.

### T-MOB-21 · D2 Voice-guided tutorial *(screen rework)*
- **Closes:** FR-VOICE-10
- **Depends on:** T-MOB-06, T-MOB-13
- **Milestone:** M1
- **Layer:** mobile
**Why** — The current tutorial (111 lines, `tutorial_screen.dart`, script in `core/speech/tutorial.dart`) must become the 4-step design.
**Files** — M/C `lib/features/onboarding/ui/tutorial_screen.dart` (route `/tutorial`; moved from presentation), M `lib/core/speech/tutorial.dart` (4 steps: 1 welcome, 2 "মাইক চেপে বলুন: বাজার আটশো টাকা", 3 "ঠিক থাকলে বড় সবুজ বোতাম চাপুন", 4 "মাসের কথা শুনতে 'শুনুন' চাপুন"), D `lib/presentation/screens/tutorial_screen.dart`; ARB `tutorial_*` from `Tutorial.dc.html`.
**Steps** — 1. Progress dots plus the text "২ / ৪" in the numeral style. 2. Big picture area (mic illustration drawn with `CustomPaint` using tokens, no image assets) and the spoken caption as large text. 3. Buttons: "আবার শুনুন" (listen again), "পরের ধাপ" (primary 72 dp), "বাদ দিন" (quiet). 4. Speech starts automatically on each step and stops when leaving the step (`stopSpeaking`). 5. Finish writes `Meta('tutorial_done')` and goes to `/home`; from Settings it can be replayed.
**Contract** — none.
**Tests** — keep `tutorial_test.dart` behaviours; add: step counter shows "১ / ৪" … "৪ / ৪", speech called once per step with the step text, skip writes the flag, golden `D2_tutorial.png`.
**Acceptance** — standard.
**Done when** — tutorial matches the board and the old file is gone.

### T-MOB-22 · D8 No Bangla voice fallback *(screen)* and `VoiceService` capability probe
- **Closes:** FR-VOICE-07
- **Depends on:** T-MOB-06
- **Milestone:** M1
- **Layer:** mobile
**Why** — If the phone cannot recognise Bangla or has no Bangla voice, say so plainly and keep typing working.
**Files** — M `lib/core/speech/voice_service.dart` — add `Future<VoiceCapabilities> capabilities()` (`{canListen, hasBanglaRecognizer, canSpeak, hasBanglaVoice}`; recogniser via `SpeechToText.locales()` containing `bn_BD` or `bn_IN`; voice via `FlutterTts.getVoices` / `isLanguageAvailable('bn-BD')`) and `Future<void> openVoiceInstall()` (intent `com.google.android.tts` install via `url_launcher` to `market://details?id=com.google.android.tts`, fallback to the https Play URL); C `lib/features/voice/ui/voice_fallback_screen.dart` (route `/voice-fallback`, also shown as a bottom sheet from the mic button); C `lib/features/voice/state/voice_capability_provider.dart`; ARB `voice_fallback_*` from `VoiceFallback.dc.html`.
**Steps** — 1. Probe once at app start and after returning from the Play Store. 2. If `!canListen || !hasBanglaRecognizer`: mic buttons across the app (Home, A3, Ask) route to this screen the first time and show a small "লিখে দিন" hint thereafter instead of failing. 3. The screen has the explanation, a "বাংলা ভয়েস ইনস্টল করুন" primary button, and the **typed quick-add field working inline** (it calls the same parse pipeline as A3). 4. If only TTS lacks Bangla, results are shown as text without auto read-aloud and a banner `BannerStrip` explains how to install.
**Contract** — none.
**Tests** — `voice_capability_test.dart` with a scripted `FakeVoiceService`; `voice_fallback_screen_test.dart`: typing "bazar 850 cash" produces a draft via the fake parse; golden `D8_voice_fallback.png`.
**Acceptance** — standard.
**Done when** — on a fake device without a Bangla recogniser, every mic tap leads here and typing still works.

---

## M2 · MVP ledger screens

### T-MOB-23 · Home (`Main`) *(screen)*
- **Closes:** FR-HOME-01, FR-NAV-01, FR-BUD-06 (entry point), AC-01 (client)
- **Depends on:** T-MOB-06, T-MOB-08, T-MOB-09, T-MOB-11, T-MOB-24
- **Milestone:** M2
- **Layer:** mobile
**Why** — One home for money and family: month spending, budget warning, the big speak button, buzz/chat/video, family avatars, latest activity.
**Files** — C `lib/features/home/ui/home_screen.dart` (route `/home`, tab 0), `lib/features/home/state/home_providers.dart` (`homeSummaryProvider` → `MonthTotals` + change vs last month, `topBudgetWarningProvider` → the budget with the highest level, `recentActivityProvider` → merges last 2 chat voice/expense events (fake until T-MOB-37 provides chat data)), `lib/features/home/data/home_repository.dart` (+ fake), D `lib/presentation/screens/dashboard_screen.dart`, D `lib/presentation/widgets/glassmorphism_card.dart`; ARB `home_*` from `Main.dc.html`: "শুভ সন্ধ্যা, {name}" (time-of-day variants: সুপ্রভাত / শুভ দুপুর / শুভ সন্ধ্যা / শুভ রাত্রি), "আমার পরিবার", "{month}ে খরচ", "গত মাসের চেয়ে {amount} বেশি|কম", "শুনুন", "{name}-এর বাজেটের {percent} শেষ", "{name}কে জানান", "বলে খরচ লিখুন", tiles "কম্পন", "কথা", "ভিডিও", legend "সবুজ = অনলাইন · ধূসর = অফলাইন".
**Steps** — 1. Layout top to bottom (390 wide, 20 dp side padding): greeting + 56 dp gear button (route `/settings`); green card radius 22 (`green`, white text, 32 sp amount, "শুনুন" white pill 56 dp reading the month summary through `ListenButton`); amber-tint strip with warning icon and "আম্মুকে জানান" 48 dp amber pill (opens `/buzz` with phrase "বাজেট শেষ" and the admin as default recipient; hidden when no budget is at warning/exceeded); big amber 84 dp pill "বলে খরচ লিখুন" with 40 dp mic (starts A3, T-MOB-28); three 84 dp tiles (কম্পন amber-tint `#FDEBCB`/`#6B3F00`, কথা green, ভিডিও green) → `/buzz`, `/talk`, call picker; avatars row (56 dp with presence dots, name 13 semibold, tapping opens a bottom sheet with "কম্পন" "কথা" "ভিডিও" for that member); two activity rows (white, radius 16, border); bottom tabs (`AppBottomTabs`, 72 dp, কথা badge). 2. Viewer role: hide "বলে খরচ লিখুন" and the add flows; show the remittance card instead (T-MOB-59). 3. Simple mode: replaced by `SimpleHomeScreen` (T-MOB-50) at the same route via `homeVariantProvider`. 4. Pull to refresh runs a sync (T-MOB-48). 5. Offline banner strip (T-MOB-73) shows above the card when offline.
**Contract** — month totals from local DB (T-MOB-24); budgets from `CachedBudgets`.
**Tests** — `home_screen_test.dart`: exact Bangla strings above for fake data (৳ ৪২,৫০০, ৳ ৩,২০০ বেশি, আম্মুকে জানান); warning strip hidden when all budgets ok; viewer hides the mic; tapping "কম্পন" opens `/buzz`; Simple mode variant selected when `uiScale == simple`; AC-01 client part: after a fake sync adds a second member's expense the total updates within one frame; goldens `Main_home.png`, `Main_home_dark.png`.
**Acceptance** — standard.
**Done when** — matches `Main.dc.html` within 2% in light and dark.

### T-MOB-24 · Local transaction repository: filters, pagination, restore (schema v5)
- **Closes:** FR-TXN-02, FR-TXN-03 (restore), FR-TXN-05, FR-TXN-07 (attachment field), FR-TXN-08 (split group), GAP-LED-01 (client)
- **Depends on:** T-MOB-11
- **Milestone:** M2
- **Layer:** mobile
**Why** — B1, D4, D5 and Home need a proper local query layer on top of `LocalStore`.
**Files**
- M `lib/data/database/tables.dart` — `Transactions` gains `familyId` (text, default `''` migrated to the active family), `splitGroupId` (text nullable), `attachmentKey` (text nullable), `paidByUserId` (text nullable), `createdBy` (text nullable); index `txn_family_time (familyId, occurredAt DESC, id DESC)`.
- M `lib/data/database/database.dart` — `schemaVersion => 5`; `if (from < 5) { addColumn × 5; customStatement('CREATE INDEX txn_family_time …'); customStatement("UPDATE transactions SET family_id = (SELECT value FROM meta WHERE key='active_family') WHERE family_id=''"); }`; schema dump `drift_schemas/drift_schema_v5.json`.
- M `lib/data/database/local_store.dart` — keep `addTransaction/updateTransaction/deleteTransaction` and add `restoreTransaction(id)` (clears `deletedAt`, new HLC, new `localSeq`, only if deleted < 30 days ago), `purgeOldTombstones()` (> 30 days after being synced, never before), `Future<TxnPage> page(TxnQuery q, {String? cursor, int limit = 50})`, `Stream<List<Transaction>> watch(TxnQuery q)`, `Future<Transaction?> byId`, `totals(range)` unchanged.
- C `lib/features/transactions/domain/txn_query.dart` — `TxnQuery {String familyId; String? month; String? categoryId; String? paidByUserId; String? accountId; String? type; String? source; String? text; bool includePrivateOf(String myUserId)}`; **private rows are returned only when `createdBy == myUserId`** (FR-TXN-05).
- C `lib/features/transactions/data/transaction_repository.dart` (interface), `local_transaction_repository.dart` (real; everything local), `fake_transaction_repository.dart`.
**Steps** — 1. Cursor = base64 of `occurredAt|id`. 2. Page ordering `occurredAt DESC, id DESC`. 3. Day headers computed in `Asia/Dhaka` ("আজ", "গতকাল", else "১০ নভেম্বর"). 4. Search `text` uses `LIKE` on note and counterparty (case-insensitive for Latin). 5. Writes go through the repository so the same HLC code path is used (`LocalStore._tick`) and `localSeq` bumps for sync.
**Contract** — a `TxnPage { List<Transaction> items; String? nextCursor; }`.
**Tests** — `test/data/database/migration_v4_to_v5_test.dart`; `test/features/transactions/transaction_repository_test.dart`: 120 rows → three pages (50/50/20) in stable order; filters by member and account; private rows hidden from others; delete → restore within 30 days returns the row with a newer HLC; restore after 31 days fails with `RestoreWindowClosed`; purge never removes unsynced tombstones.
**Acceptance** — `cd apps/mobile && dart run drift_dev schema dump lib/data/database/database.dart drift_schemas/ && flutter test test/data/database test/features/transactions`
**Done when** — AC-14 client-side equivalent passes on the local store.

### T-MOB-25 · B1 তালিকা tab: transactions list *(screen)*
- **Closes:** FR-TXN-02, FR-REP-04 (CSV button), FR-TXN-05 (marker)
- **Depends on:** T-MOB-24, T-MOB-06, T-MOB-08
- **Milestone:** M2
- **Layer:** mobile
**Why** — Browse the month's entries with simple filters.
**Files** — C `lib/features/transactions/ui/transactions_screen.dart` (route `/list`, tab 2), `widgets/txn_row.dart`, `widgets/filter_chips.dart`, `state/transactions_controller.dart` (infinite list with `nextCursor`), D `lib/presentation/screens/transaction_screen.dart`; ARB `txn_list_*` from `Txns.dc.html`: "খরচের তালিকা", "CSV নিন", month switcher aria labels "আগের মাস" / "পরের মাস", filter chips "সবাই" + one per member + account names, day headers, "ব্যক্তিগত খরচ" / "শুধু আপনি দেখছেন", "+ নতুন খরচ লিখুন".
**Steps** — 1. Header row (title 28 bold green, "CSV নিন" outlined 48 dp pill); month row with 48 dp arrows and the month name 20 bold; chips row (48 dp pills, selected = green tint with green border + tick); list rows: 48 dp rounded avatar-initial tile (category colour), title 18 semibold, subtitle 14 muted "আম্মু · ক্যাশ · কণ্ঠ থেকে" (source words: কণ্ঠ থেকে / এসএমএস থেকে / ছবি থেকে / হাতে), amount 20 bold (expense `danger` with "−", income green with "+"); private rows show a lock icon tile; primary 64 dp pill. 2. Tap → `/txn/:id`. 3. Swipe actions are not used (low-literacy rule). 4. "CSV নিন": local export for the visible month built on device (`csv` package not needed; manual quoting) and shared with `share_plus`; Viewer role hides it. 5. Empty state (`EmptyState`): "এ মাসে কোনো খরচ নেই" with "বলে খরচ লিখুন". 6. Pull to refresh = sync.
**Contract** — none.
**Tests** — `transactions_screen_test.dart`: shows "আজ" and "গতকাল" headers, amounts in Bangla digits, "−৳ ৮৫০" in danger colour with a minus sign, chip filter reduces rows, month arrows change the query, CSV contains header `date,type,amount_paisa,category,account,member,note`, private row marker; scroll to the end loads the next page (fake with 120 rows); goldens `B1_transactions.png`, `B1_transactions_dark.png`.
**Acceptance** — standard.
**Done when** — matches `Txns.dc.html`.

### T-MOB-26 · D4 Add expense by hand *(screen)*
- **Closes:** FR-TXN-01, FR-TXN-09, FR-TXN-05, FR-ACC-01 (chips)
- **Depends on:** T-MOB-24, T-MOB-05, T-MOB-06
- **Milestone:** M2
- **Layer:** mobile
**Why** — Typing is the fallback for voice; it must still be simple.
**Files** — C `lib/features/transactions/ui/add_expense_screen.dart` (route `/add`), `widgets/amount_keypad.dart` (custom keypad 3×4, 64 dp keys, Bangla or Latin digits by numeral style), `widgets/category_icon_row.dart`, `widgets/account_chips.dart`, `state/add_expense_controller.dart`; ARB `txn_add_*` from `AddExpense.dc.html` (read it for the exact Bangla: type segments খরচ / আয় / স্থানান্তর, "কত টাকা?", "কোন খাতে?", "কীভাবে দিলেন?", "কে দিলেন?", "তারিখ", "আজ"/"গতকাল", "নোট", "ফি", "ব্যক্তিগত (শুধু আমি দেখব)", save button).
**Steps** — 1. Amount shown 52 sp bold with the amount in words beneath ("আটশো পঞ্চাশ টাকা", from `amountInWords`) and a 🔊-style `ListenButton`. 2. Category row uses the same 12 icons as A4 (shared `CategoryIcon` in `lib/ui/category_icon.dart`, created here). 3. Account chips from `CachedAccounts` (non-archived). 4. "কে দিলেন?" defaults to me; only Admin/Owner can pick someone else. 5. Private switch sets `isPrivate`. 6. Save writes via `TransactionRepository.add` with `source: manual`, HLC stamped, then returns to the previous screen and shows a `SnackBar` "রাখা হয়েছে" with "বাতিল করুন" (undo within 6 s = delete). 7. Validation: amount > 0 and ≤ ৳1 crore; category required for expense/income.
**Contract** — local only; server gets it on sync.
**Tests** — `add_expense_screen_test.dart`: keypad input "৮৫০" produces 85000 paisa; words line "আটশো পঞ্চাশ টাকা"; transfer hides category; private flag stored; viewer role cannot open the route (redirect to `/home`); undo within 6 s removes the row; golden `D4_add_expense.png`.
**Acceptance** — standard.
**Done when** — an expense saved offline appears in B1 and Home totals.

### T-MOB-27 · D5 Transaction detail, edit, delete, undo *(screen)*
- **Closes:** FR-TXN-03, FR-TXN-10, FR-TXN-07 (show attachment)
- **Depends on:** T-MOB-24, T-MOB-26
- **Milestone:** M2
- **Layer:** mobile
**Why** — See everything about one entry, change or remove it, and undo a delete.
**Files** — C `lib/features/transactions/ui/transaction_detail_screen.dart` (route `/txn/:id`), reuse `AddExpenseScreen` in edit mode (`/txn/:id/edit`), ARB `txn_detail_*` from `TxnDetail.dc.html`.
**Steps** — 1. Show amount (46 sp), category, account, who, date-time, source chip, TrxID (copyable), note, private marker, attachment thumbnail (loaded from `MediaCache`, tap = full screen). 2. Buttons: "বদলান" (outlined) and "মুছুন" (danger outlined, 56 dp, never the largest). 3. Permission: Members see "আপনি শুধু নিজের খরচ বদলাতে পারেন" instead of buttons on others' rows; Admin/Owner can edit all. 4. Delete → soft delete, show the undo banner `BannerStrip`: "মুছে ফেলা হয়েছে · ৩০ দিন পর্যন্ত ফেরত পাবেন" + "ফেরত আনুন" which calls `restoreTransaction`. 5. Edits bump HLC through the repository.
**Contract** — none.
**Tests** — `transaction_detail_test.dart`: role matrix; delete → banner → restore returns the row; editing amount updates list; golden `D5_transaction_detail.png`.
**Acceptance** — standard.
**Done when** — AC-14 delete/restore path works in the UI.

### T-MOB-28 · A3 Voice entry, read-back, offline quick parser *(screen flow)*
- **Closes:** FR-VOICE-01, -02, -03, -05, -06, FR-AI-01, -05, -13, AC-08, AC-09 (client)
- **Depends on:** T-MOB-22, T-MOB-05, T-MOB-24, T-MOB-29
- **Milestone:** M2
- **Layer:** mobile
**Why** — The product's core: say it, hear it, confirm it.
**Files**
- C `lib/features/entry/domain/quick_parser.dart` — Dart port of the SRS §6.1 offline quick parser: `QuickParseResult? quickParse(String text, DateTime nowDhaka)` using `bangla_words.dart` (already has Bangla number words) and `categories.dart` keywords; one amount + one known keyword → draft with confidence 0.8; amount without keyword → draft with `categoryKey == null`; relative dates "আজ", "গতকাল".
- C `lib/features/entry/data/entry_repository.dart` — `Future<List<TransactionDraft>> parse(String text, {required EntrySource source})` (real: tries quick parser first → pending queue offline → `POST /ai/parse`); `fake_entry_repository.dart`.
- C `lib/features/entry/state/entry_controller.dart` — states `idle → listening → parsing → drafts(list) → saving`, handles quota errors (`ai_quota` → `QuotaExceeded`, T-MOB-65 card) and offline queue (T-MOB-49).
- C `lib/features/entry/ui/voice_entry_screen.dart` (route `/add/voice`, also the target of Home's big button) and `ui/draft_card.dart`.
- M `lib/presentation/screens/ai_entry_screen.dart` → delete after porting its summary part (moved to T-MOB-31) and SMS paste (T-MOB-30).
- M ARB `entry_*` from `VoiceEntry.dc.html`: "আপনি বললেন:", "আবার শুনুন", "ঠিক আছে?", "না", "হ্যাঁ, রাখুন", "টাকা বা খাত বদলাতে চাই".
**Steps** — 1. Layout per board: transcript block (22 sp semibold), a white card radius 28 with a 2 dp green border containing the category tile 64 dp (category colour), name 20 bold, subtitle "খরচ · ক্যাশ · আজ", amount 52 bold green, words line 17 muted; "আবার শুনুন" 64 dp green-tint pill; "ঠিক আছে?" 20 semibold centred; bottom row: ✗ "না" 104 dp circle with 3 dp danger border, ✓ "হ্যাঁ, রাখুন" 104 dp pill green with 44 dp check; quiet text button "টাকা বা খাত বদলাতে চাই" (opens D4 prefilled). 2. After parsing, **speak the read-back automatically**: `"{category} খাতে {amountInWords} টাকা খরচ। ঠিক আছে?"` (exact sentence template, e.g. "বাজার ও মুদি খাতে আটশো পঞ্চাশ টাকা খরচ। ঠিক আছে?"); when category is unknown speak "কিসের জন্য? নিচের ছবিতে চাপ দিন।" and open the picker (T-MOB-29). 3. Several drafts → a vertical list of cards, each with its own 🔊/✓/✗ (FR-VOICE-06). 4. Save → `TransactionRepository.add(source: voice)`; mark draft `pendingId` removed from the queue. 5. NFR-14: when the quick parser matches, no network is used and read-back starts ≤ 3 s after the final transcript (measured in the test with `FakeClock`). 6. Sync with `ListenButton` and `VoiceService` hooks so the screen is testable with scripted transcripts. 7. `D8` fallback when mic unavailable.
**Contract** — `POST /v1/families/:id/ai/parse {text, source}` → `{drafts:[…], ruleApplied?}`; errors `ai_quota`, `ai_unavailable`.
**Tests** — `test/features/entry/quick_parser_test.dart`: "আজ বাজারে আটশো পঞ্চাশ টাকা ক্যাশে" → 85000 paisa, key `bazaar`, account type cash, date today (AC-08, **no repository network call**: assert the fake API call count = 0); "পাঁচশো টাকা দিলাম" → 50000 paisa with `categoryKey == null` (AC-09); "দেড় হাজার টাকা ওষুধ" → 150000 medical; two amounts → null (falls to AI); `voice_entry_screen_test.dart`: read-back sentence exact; unknown category opens picker route; ✓ saves with `source == 'voice'`; ✗ discards; golden `A3_voice_entry.png`.
**Acceptance** — standard.
**Done when** — AC-08 and AC-09 pass; `ai_entry_screen.dart` is deleted.

### T-MOB-29 · A4 Category picker by picture *(screen)*
- **Closes:** FR-VOICE-06, FR-CAT-02 (icon set)
- **Depends on:** T-MOB-06, T-MOB-26 (CategoryIcon)
- **Milestone:** M2
- **Layer:** mobile
**Why** — When the category is unknown, choose by picture; tapping also speaks the name.
**Files** — C `lib/features/entry/ui/category_picker_screen.dart` (route `/add/category`, returns a `Category` via `context.pop`), M `lib/ui/category_icon.dart` (12 default icons: বাজার, বাসা ভাড়া, বিল, মোবাইল রিচার্জ, যাতায়াত, পড়ালেখা, চিকিৎসা, সাহায্যকারী, বাইরে খাওয়া, কাপড়, দান-সদকা, ঈদ-উৎসব, অন্যান্য; icon key → vector path map used by E2 too), ARB `entry_picker_*` from `Picker.dc.html`: "কিসের জন্য?", "ছবিতে চাপ দিন, নামটি শোনা যাবে।", confirm "{category}য় রাখুন".
**Steps** — 1. Top strip: amount 34 sp green, words, 56 dp listen button. 2. 3-column grid, cells 104 dp tall radius 22, 36 dp icon + 16 sp label; selected cell green tint with 3 dp green border and "✓". 3. First tap selects and speaks the name; confirm button 72 dp. 4. Categories come from `CachedCategories` (hidden ones excluded, family customisations included); more than 12 → grid scrolls. 5. Selecting a category different from the AI's suggestion triggers the rule-learning prompt (T-MOB-61) after save.
**Contract** — none.
**Tests** — `category_picker_test.dart`: tap speaks the Bangla name (`FakeVoiceService.spoken`); only visible categories shown; confirm returns the selection; golden `A4_category_picker.png`.
**Acceptance** — standard.
**Done when** — AC-09 completes with the picker.

### T-MOB-30 · A5 Paste bKash/Nagad/Rocket SMS *(screen)*
- **Closes:** FR-AI-02, FR-TXN-04, AC-03, AC-04 (client)
- **Depends on:** T-MOB-24, T-MOB-28
- **Milestone:** M2
- **Layer:** mobile
**Why** — Turn a pasted or shared MFS SMS into an entry with no AI call.
**Files** — C `lib/features/entry/ui/sms_paste_screen.dart` (route `/add/sms`), M `lib/core/sms_parser/sms_parser_engine.dart` (extend to return `SmsDraft {kind, amountPaisa, feePaisa, counterpartyMasked, trxId, balancePaisa, occurredAt, provider}`; templates for bKash/Nagad/Rocket: send money, payment, cash out, bill pay, recharge, received), D `PendingSmsScreen` in `settings_screen.dart`, M Android manifest: share-target intent filter `ACTION_SEND` `text/plain` on `MainActivity` → route `/add/sms?text=…`; ARB `entry_sms_*` from `Sms.dc.html`: "এসএমএস থেকে লিখুন", "বিকাশ, নগদ বা রকেটের মেসেজ পেস্ট করুন।", "{provider} মেসেজ চেনা গেছে · এআই লাগেনি", fields কাকে / ফি / অ্যাকাউন্ট / সময় / ট্রানজ্যাকশন, warning "এই মেসেজ আগে রাখা হয়নি। কোন খাত?", buttons "না" and "✓ রাখুন".
**Steps** — 1. Paste area (14 sp, dashed border) with a "পেস্ট করুন" button reading the clipboard. 2. Parse locally with the Dart engine; if no template matches, call `ai/parse` (counts against quota). 3. Show the result card per the board (amount 46 sp green; rows with muted labels). 4. Duplicate check: `LocalStore.existsTrxId(familyId, trxId)` → card changes to "এই মেসেজ আগেই রাখা হয়েছে" and the save button is disabled; the server's `409 duplicate_trx_id` on sync marks the local row `rejected` and surfaces a notice (T-MOB-49). 5. Category chips default from provider (`পরিবারকে সাহায্য` for send-money to a person). 6. Raw SMS text is **never stored** (cleared from memory after parse).
**Contract** — shared test fixtures `packages/shared/test-vectors/sms/*.json` run by the Dart engine test.
**Tests** — extend `test/core/sms_parser_test.dart` with every fixture (bKash send money "You have sent Tk 2,000.00 to 01XXXXX-789 …" → 200000 paisa, TrxID `9K4L2M7N`, fee 0); `sms_paste_screen_test.dart`: no API call for template match (AC-03), duplicate detection (AC-04), share-intent text prefilled; golden `A5_sms.png`.
**Acceptance** — standard.
**Done when** — AC-03 and AC-04 pass offline.

### T-MOB-31 · B2 Monthly summary and Listen *(screen)*
- **Closes:** FR-AI-11, FR-VOICE-04, FR-VOICE-05, AC-10 (client)
- **Depends on:** T-MOB-06, T-MOB-05
- **Milestone:** M2
- **Layer:** mobile
**Why** — Explain the month in a few plain sentences and read it aloud.
**Files** — C `lib/features/summary/ui/summary_screen.dart` (route `/summary`), `data/summary_repository.dart` (`Future<MonthlySummary> load(String month, Locale)` → `GET /ai/summary`; offline falls back to a local template built from local totals using the same sentence patterns), fake; ARB `summary_*` from `Summary.dc.html`: "এ মাস কেমন গেল?", sentence templates, "সংখ্যাগুলো আপনার হিসাব থেকে নেওয়া, এআই বানায়নি।", "শুনুন", caption "টাকার অঙ্ক কথায় পড়ে শোনানো হবে: …".
**Steps** — 1. Card white radius 28 with sentences at 22 sp (amounts bold; the increase in danger colour, with the word "বেশি"), the tip in a green-tint box 20 sp. 2. The huge amber "শুনুন" button 100 dp tall (46 dp icon). 3. Listen speaks `speechText` (amounts in words) at rate 0.9; the on-screen `text` keeps ৳ digits (FR-VOICE-04). 4. Show "AI ব্যবহার হয়েছে" nowhere; `usedAi` only affects the footnote. 5. Cache last summary per month in `Meta('summary:<month>')`.
**Contract** — `{text, speechText, usedAi}`.
**Tests** — `summary_screen_test.dart`: screen shows "৳ ৪২,৫০০"; Listen speaks the `speechText` containing "বিয়াল্লিশ হাজার পাঁচশো টাকা" (AC-10); offline fallback renders; golden `B2_summary.png`.
**Acceptance** — standard.
**Done when** — AC-10 client part passes.

### T-MOB-32 · B3 Budgets tab, alerts and spoken alerts *(screen)*
- **Closes:** FR-BUD-01, -02, -06, -07, FR-VOICE-10 (spoken alerts), GAP-MOB-10, AC-05 (client)
- **Depends on:** T-MOB-11, T-MOB-06, T-MOB-34
- **Milestone:** M2
- **Layer:** mobile
**Why** — Show budget status with colour + icon + words and let people tell someone.
**Files** — C `lib/features/budgets/ui/budgets_screen.dart` (route `/budget`, tab 3), `widgets/budget_card.dart`, `ui/budget_edit_sheet.dart` ("+ বাজেট দিন": category picker + amount keypad), `data/budget_repository.dart` (`Stream<List<BudgetStatus>> watch(month)`, `put(List<BudgetInput>)` → `PUT /budgets?month=`; offline edits queued in `Meta('budget_patch')`), M `lib/core/speech/budget_alerts.dart` (use `Money`; keep logic and tests), C `lib/features/budgets/state/spoken_alert_controller.dart` (calls `alertsToSpeak` after every local sync that changes `CachedBudgets` and when the app is foregrounded; remembers `lastSpoken` per month in `Meta('alerts_spoken:<month>')`); ARB `budget_*` from `Budgets.dc.html`: "মাসের বাজেট", "গত মাসের বাজেট নিজে থেকেই চলে এসেছে", statuses "ঠিক আছে" / "{percent}% পার হয়েছে · সাবধান" / "বাজেট শেষ · {amount} বেশি", "আম্মুকে কম্পন দিন", "+ বাজেট দিন", festival card "ঈদুল আযহা (উৎসবের বাজেট)".
**Steps** — 1. Cards radius 20, 2 dp border (danger border when exceeded, green for the overall card), title 18 bold, amount "৳ ১০,৫০০ / ১০,০০০", 14 dp progress bar (amber warning, danger exceeded, `#2E9E4F` ok), status row with 22 dp icon + 15 bold text (never colour alone). 2. "আম্মুকে কম্পন দিন" opens `/buzz` with the budget admin preselected and phrase "বাজেট শেষ". 3. Bottom: "+ বাজেট দিন" 64 dp and a 72 dp amber speaker button that speaks every non-ok alert. 4. Only Owner/Admin can edit budgets; others see read-only cards. 5. Festival budgets list under the cards, "নতুন উৎসব বাজেট" → `/festival/new` (T-MOB-57).
**Contract** — `GET /v1/families/:id/budgets?month=` → `[{id,categoryId,name,limitPaisa,spentPaisa,level}]`.
**Tests** — `budgets_screen_test.dart`: three states render the exact status strings; member sees no edit button; spoken alert controller speaks each level once and again only when worse (existing `budget_alerts_test.dart` kept); AC-05 client: crossing 80% then 100% with fake data triggers exactly two spoken alerts; goldens `B3_budgets.png`, `B3_budgets_dark.png`.
**Acceptance** — standard.
**Done when** — matches `Budgets.dc.html`.

### T-MOB-33 · B6 Settings *(screen)*
- **Closes:** FR-AUTH-04 (links), FR-NOTIF-05 (quiet hours), FR-VOICE-09 (toggle), FR-SYNC-04 (switch)
- **Depends on:** T-MOB-20
- **Milestone:** M2
- **Layer:** mobile
**Why** — One settings list, linked from the gear on Home and Family.
**Files** — C `lib/features/settings/ui/settings_screen.dart` (route `/settings`), D `lib/presentation/screens/settings_screen.dart` (including the "Bank Approvals" placeholder), ARB `settings_*` from `Settings.dc.html`: "সেটিং", "সহজ মোড", "ভাষা", "সংখ্যা", "রোজ মনে করান", "কম্পন ও আওয়াজ" (quiet-hours subtitle "রাত ১০টা থেকে সকাল ৬টা চুপ"), "কাছের ফোনের সাথে সিঙ্ক", "খরচের তালিকা নামান (CSV)", "খাত ও অ্যাকাউন্ট", "কীভাবে ব্যবহার করবেন (শুনুন)", "গোপনীয়তা নীতি", "আমার তথ্য মুছে দিন".
**Steps** — 1. Cards of rows with 68 dp min height, 56×32 switches. 2. Quiet-hours row opens a sheet with two big time pickers, saved to preferences and pushed to `PUT /v1/me/notification-preferences` (T-MOB-35). 3. Nearby sync switch drives the existing peer sync engine (moved from the old screen). 4. Links go to `/accounts`, `/categories`, `/profile`, `/tutorial`, `/consent/policy`, `/delete-account`; "সার্ভারের সাথে সিঙ্ক" row is removed (sync is automatic, status lives at `/sync`).
**Contract** — none new.
**Tests** — `settings_screen_test.dart`: rows exact; quiet-hours change persists; golden `B6_settings.png`.
**Acceptance** — standard.
**Done when** — the old settings screen is deleted.

### T-MOB-34 · FCM, notification channels, device registration
- **Closes:** FR-NOT-01, FR-NOTIF-06, FR-NOTIF-07 (client side), FR-AUTH-11, GAP-MOB-06 (part 1)
- **Depends on:** T-MOB-07, T-MOB-08 (backend T-NOTIF devices + sender; use `FakePushGateway` in tests)
- **Milestone:** M2
- **Layer:** mobile
**Why** — Push is how buzz, budget alerts and reminders reach a phone that is not open.
**Files**
- M `pubspec.yaml` add `firebase_core ^3.8.0`, `firebase_messaging ^15.1.5`, `flutter_local_notifications ^18.0.1`.
- M `android/build.gradle.kts`, `android/app/build.gradle.kts` — apply `com.google.gms.google-services` **only if** `android/app/google-services.json` exists (`if (file("google-services.json").exists()) apply(plugin = …)`), so CI without credentials still builds.
- M `android/app/src/main/AndroidManifest.xml` — permissions `POST_NOTIFICATIONS`, `VIBRATE`, `USE_FULL_SCREEN_INTENT`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`; default channel meta-data.
- C `lib/core/push/push_service.dart` — `abstract class PushService { Future<void> init(); Stream<PushMessage> get foreground; Future<String?> token(); Stream<String> get tokenRefresh; }`, `FcmPushService`, `FakePushService` (test helper `emit(PushMessage)`).
- C `lib/core/push/notification_channels.dart` — creates channels on first launch with Bangla names: `nudge` ("কম্পন", importance max, vibration pattern `[0,300,150,300]`, sound off), `chat` ("কথা", high), `alerts` ("বাজেট সতর্কতা", high), `reminders` ("মনে করানো", default), `calls` ("ভিডিও কল", max, ringtone + vibration `[0,800,400,800]`, full-screen). Names and descriptions are ARB keys `push_channel_*`.
- C `lib/core/push/device_registrar.dart` — on sign-in and on token refresh calls `PUT /v1/me/devices/:deviceId {platform:'android', fcmToken, appVersion, locale}`; on sign-out `DELETE`.
- C `lib/core/push/push_router.dart` — maps `data.type` (`nudge`, `msg`, `budget`, `reminder`, `call`, `invite`) to routes (`/buzz/incoming/:id`, `/talk/:conversationId`, `/budget`, `/notifications`, `/call/:id`, `/join/:token`) and calls the router (`deepLinkProvider`).
- M `lib/main.dart` — register `FirebaseMessaging.onBackgroundMessage(backgroundHandler)` (top-level `@pragma('vm:entry-point')`), implemented in T-MOB-42.
- C `lib/features/notifications/data/push_permission.dart` — request `POST_NOTIFICATIONS` (Android 13+) the first time after login with the explainer (T-MOB-72).
**Steps** — 1. Initialise Firebase guarded by `Firebase.apps` and a try/catch (no config → `FakePushService`). 2. Create channels. 3. Register device. 4. Foreground messages become inbox items through `InboxRepository` (T-MOB-35) and, for `nudge`, go straight to the vibration engine (T-MOB-42). 5. Notification tap → `push_router`.
**Contract** — FCM data payload keys: `type`, `id`, `familyId`, `title`, `body`, `speech` (all strings) plus per type: nudge `{from, phraseId, phrase, intensity}`; msg `{conversationId, kind}`; call `{callId, from, kind}`.
**Tests** — `push_router_test.dart` (each type → route), `device_registrar_test.dart` (register on sign-in, refresh on token change, delete on sign-out), `notification_channels_test.dart` (five channels with expected ids and importance using a mock plugin), `push_service_fake_test.dart`.
**Acceptance** — `cd apps/mobile && flutter test test/core/push && flutter build apk --debug` (must succeed without `google-services.json`)
**Done when** — with a fake push gateway the app registers a device and routes taps.

### T-MOB-35 · F3 Notifications inbox and listen-aloud *(screen, schema v6)*
- **Closes:** FR-NOTIF-04, FR-NOTIF-05, FR-NOT-02, FR-NOT-03, FR-BUD-02 (client)
- **Depends on:** T-MOB-34, T-MOB-24
- **Milestone:** M2
- **Layer:** mobile
**Why** — A calm list of everything the app told you, each item readable aloud.
**Files**
- M `lib/data/database/tables.dart` — `class InboxItems extends Table { TextColumn get id => text()(); TextColumn get kind => text()(); TextColumn get title => text()(); TextColumn get body => text()(); TextColumn get speechText => text().nullable()(); TextColumn get dataJson => text().withDefault(const Constant('{}'))(); TextColumn get createdAt => text()(); TextColumn get readAt => text().nullable()(); @override Set<Column> get primaryKey => {id}; }`
- M `database.dart` — `schemaVersion => 6`, `if (from < 6) await m.createTable(inboxItems)`; dump `drift_schema_v6.json`.
- C `lib/features/notifications/data/inbox_repository.dart` (`Stream<List<InboxItem>> watch()`, `Future<void> refresh()` → `GET /v1/inbox?cursor=` (last 90 days), `markRead(ids)` → `POST /v1/inbox/read`, `clear()` → `DELETE /v1/inbox`, `unreadCount`), fake, API.
- C `lib/features/notifications/ui/notifications_screen.dart` (route `/notifications`), ARB `notif_*` from `Notifications.dc.html` (items: বাজেট ৮০% (বাজার), আমন্ত্রণ (০১৭৯৮… যোগ দিতে চায়), রোজকার মনে করানো "আজকের খরচ লিখেছেন?", বিল মনে করানো, কম্পন; actions "সব শুনুন", settings link).
- C `lib/features/notifications/state/reminder_scheduler.dart` — local daily reminder fallback: schedules a `flutter_local_notifications` zoned notification at the user's time (default 21:00 Asia/Dhaka) on channel `reminders` **only when push is unavailable** (no FCM token), cancelled when the server sends one.
- M `lib/features/home/ui/home_screen.dart` — add a 48 dp bell button next to the gear showing the unread count (Bangla digits) from `inboxRepository.unreadCount`.
**Steps** — 1. Each row: 48 dp icon tile by kind, title 17 bold, body 15, time in words ("আজ সকালে"), per-row `ListenButton` (speaks `speechText ?? "$title। $body"`), unread rows have a green dot and bold title. 2. "সব শুনুন" speaks unread items one after another with 700 ms pauses and marks them read; stop button replaces it while speaking. 3. Tap item → mark read and route via `push_router` by `kind`. 4. Quiet-hours note card at the top when quiet hours are active. 5. Pull to refresh.
**Contract** — inbox item `{id, kind, title, body, speechText, data, createdAt, readAt}`.
**Tests** — `notifications_screen_test.dart`: unread styling, listen button speaks `speechText`, "সব শুনুন" order and read-marking, tap routes; `migration_v5_to_v6_test.dart`; `reminder_scheduler_test.dart`; golden `F3_notifications.png`.
**Acceptance** — standard + `flutter test test/data/database`.
**Done when** — a push received in the foreground shows up here and is readable aloud.

---

## M3 · Family communication (buzz, chat, voice notes, presence)

Backend counterparts: `T-COMM` (module `comms`) and `T-NOTIF`. Every task below is built and tested against `FakeRealtimeServer` and fake repositories first.

### T-MOB-36 · Realtime client (WebSocket) with reconnect, ack and catch-up
- **Closes:** SRS §5.4, NFR-17, FR-CHAT-06 (transport), FR-PRES-01 (transport)
- **Depends on:** T-MOB-07, T-MOB-12
- **Milestone:** M3
- **Layer:** mobile
**Why** — One socket delivers buzz, chat, presence, shopping updates and call signalling.
**Files**
- M `pubspec.yaml` add `web_socket_channel ^3.0.1`, `connectivity_plus ^6.1.0`.
- C `lib/data/realtime/realtime_client.dart` — `class RealtimeClient { Stream<RealtimeEvent> get events; Stream<RealtimeStatus> get status; Future<void> connect(); Future<void> disconnect(); Future<void> send(ClientFrame f, {Duration ackTimeout = const Duration(seconds: 10)}); }`
- C `lib/data/realtime/frames.dart` — `sealed class RealtimeEvent` with `NudgeEvent`, `NudgeStateEvent`, `MessageEvent`, `ReceiptEvent`, `MessageDeletedEvent`, `PresenceEvent`, `TypingEvent`, `InboxEvent`, `ShoppingItemEvent`, `CallSignalEvent(type, payload)`, `AckEvent`, `ErrEvent`; envelope parser `RealtimeEvent.parse(Map)` ignoring unknown `t` values; `ClientFrame` builders (`auth`, `authRefresh`, `ping`, `typing`, `msgRead`, `callSignal`, `presenceHide`).
- C `lib/data/realtime/backoff.dart` — `Duration nextDelay(int attempt, Random r)` = min(30 s, 1 s × 2^attempt) × (0.5 + r.nextDouble()/2).
- C `lib/data/realtime/realtime_providers.dart` — `realtimeClientProvider`, `realtimeStatusProvider` (`connecting|online|offline`), lifecycle binding: connect when signed in and app is resumed; keep connected 30 s after pause then disconnect (FCM covers background); reconnect on `connectivity_plus` change.
- C `lib/data/realtime/catch_up.dart` — `abstract interface class CatchUp { Future<void> catchUp(); }` implemented by `ChatRepository`, `InboxRepository`, `ShoppingRepository`; `RealtimeClient` calls all registered `CatchUp`s after every successful (re)connect so events missed offline are fetched by cursor.
- C `test/helpers/fake_realtime_server.dart` — in-memory `WebSocketChannel` pair with `serverSend(event)` and recorded client frames.
**Steps** — 1. On connect send `{"t":"auth","token":<access>,"deviceId":<id>,"familyId":<active>}` within 5 s; if the server replies `err` with `unauthorized` call `SessionManager.refresh()` once and re-auth with `authRefresh`. 2. Heartbeat: `{"t":"ping"}` every 25 s; if no `pong` in 10 s treat as dead and reconnect. 3. `send` assigns a UUIDv4 `id`, resolves on matching `ack`, throws `AckTimeout`/`RealtimeError(code)` on `err`/timeout. 4. Reconnect with `nextDelay`; reset attempts after 30 s online. 5. Switching family sends a new `auth` frame (or reconnects) so subscriptions follow `activeFamilyIdProvider`. 6. Never log tokens or message bodies.
**Contract** — SRS §5.4 table (types `nudge`, `nudge.state`, `msg`, `msg.receipt`, `msg.deleted`, `presence`, `typing`, `inbox`, `shopping.item`, `call.*`, `ack`, `err`).
**Tests** — `test/data/realtime/realtime_client_test.dart`: auth frame sent first; ack resolves a send; timeout throws; unknown frame type ignored; heartbeat sent every 25 s using `fake_async`; dead socket reconnects with growing delays (1, 2, 4 s ± jitter); `catchUp` called once per reconnect; family switch re-auths; `backoff_test.dart` bounds.
**Acceptance** — `cd apps/mobile && flutter test test/data/realtime`
**Done when** — `FakeRealtimeServer` can drive any screen test.

### T-MOB-37 · Messaging local tables (schema v7) and chat repository
- **Closes:** FR-CHAT-01, -02, -04, -06, GAP-MOB-08 (part 2), DEC-14
- **Depends on:** T-MOB-36, T-MOB-11
- **Milestone:** M3
- **Layer:** mobile
**Why** — Chat is server-authoritative but must open instantly and work offline.
**Files**
- M `lib/data/database/tables.dart`:
```
class Conversations extends Table {
  TextColumn get id => text()(); TextColumn get familyId => text()();
  TextColumn get kind => text()();                       // group | direct
  TextColumn get title => text()();                      // "সবাই" or the other person's name
  TextColumn get otherUserId => text().nullable()();
  TextColumn get lastMessageId => text().nullable()();
  TextColumn get lastPreview => text().withDefault(const Constant(''))();
  TextColumn get lastKind => text().withDefault(const Constant('text'))(); // text|voice|video|nudge|expense|call|system
  TextColumn get lastAt => text().nullable()();
  IntColumn get unread => integer().withDefault(const Constant(0))();
  TextColumn get lastReadMessageId => text().nullable()();
  @override Set<Column> get primaryKey => {id};
}
class Messages extends Table {
  TextColumn get id => text()(); TextColumn get conversationId => text()();
  TextColumn get clientId => text().nullable()(); TextColumn get senderId => text()();
  TextColumn get kind => text()(); TextColumn get body => text().nullable()();
  TextColumn get mediaId => text().nullable()(); IntColumn get durationMs => integer().nullable()();
  TextColumn get metaJson => text().withDefault(const Constant('{}'))();
  TextColumn get createdAt => text()(); TextColumn get deletedAt => text().nullable()();
  TextColumn get receipt => text().withDefault(const Constant('sent'))(); // sending|sent|delivered|read|failed
  @override Set<Column> get primaryKey => {id};
}
class OutboxMessages extends Table {
  TextColumn get clientId => text()(); TextColumn get conversationId => text()();
  TextColumn get kind => text()(); TextColumn get body => text().nullable()();
  TextColumn get localMediaPath => text().nullable()(); IntColumn get durationMs => integer().nullable()();
  TextColumn get createdAt => text()(); IntColumn get attempts => integer().withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();
  @override Set<Column> get primaryKey => {clientId};
}
class MediaCache extends Table {
  TextColumn get mediaId => text()(); TextColumn get localPath => text()();
  IntColumn get bytes => integer()(); TextColumn get lastAccess => text()();
  @override Set<Column> get primaryKey => {mediaId};
}
```
  (Drift `Messages` index on `(conversationId, createdAt DESC)`.)
- M `database.dart` — `schemaVersion => 7`; `if (from < 7) { createTable ×4; customStatement('CREATE INDEX msg_conv_time ON messages (conversation_id, created_at DESC)'); }`; dump `drift_schema_v7.json`.
- C `lib/features/chat/data/chat_repository.dart`:
```
abstract class ChatRepository implements CatchUp {
  Stream<List<ConversationSummary>> watchConversations();
  Stream<List<ChatMessage>> watchMessages(String conversationId);   // newest first, last 500 cached
  Future<void> loadOlder(String conversationId);                    // GET …/messages?cursor=
  Future<String> sendText(String conversationId, String body);      // returns clientId; outbox
  Future<void> markRead(String conversationId, String upToMessageId);
  Future<void> deleteMine(String messageId);                        // within 24 h
  Future<String> openDirect(String userId);                         // returns conversationId
  Stream<int> watchTotalUnread();
}
```
  with `local_chat_repository.dart` (reads Drift, writes through REST + realtime events), `fake_chat_repository.dart` (seeded from the Chat board), `api` calls in `comms_api.dart`.
- C `lib/features/chat/state/chat_providers.dart` — `chatRepositoryProvider`, `conversationsProvider`, `messagesProvider.family`, `totalUnreadProvider` (feeds the tab badge in T-MOB-08).
**Steps** — 1. Subscribe to `MessageEvent`/`ReceiptEvent`/`MessageDeletedEvent` and apply to Drift in one transaction. 2. Trim to the last 500 messages per conversation after each insert (keep media rows). 3. `unread` increments for others' messages when the conversation is not the open one; reset by `markRead`. 4. `catchUp()` fetches `GET /v1/families/:id/conversations` then newest messages after the stored last id per conversation. 5. System cards (`kind` `nudge`, `expense`, `call`, `system`) are stored like messages with `metaJson`.
**Contract** — SRS §8.2; message `{id, clientId, conversationId, senderId, kind, body, mediaId, durationMs, meta, createdAt, deletedAt}`.
**Tests** — `migration_v6_to_v7_test.dart`; `chat_repository_test.dart`: realtime message inserted once even when delivered twice; trim to 500; unread counting; receipts update `receipt`; delete replaces body with the "মুছে ফেলা হয়েছে" display state; catch-up merges without duplicates.
**Acceptance** — `cd apps/mobile && dart run drift_dev schema dump lib/data/database/database.dart drift_schemas/ && flutter test test/features/chat test/data/database`
**Done when** — the tab badge shows `totalUnreadProvider`.

### T-MOB-38 · F1 কথা tab: conversation list *(screen)*
- **Closes:** FR-CHAT-04, FR-PRES-01 (dots), FR-NAV-01
- **Depends on:** T-MOB-37, T-MOB-06
- **Milestone:** M3
- **Layer:** mobile
**Why** — The কথা tab had no screen.
**Files** — C `lib/features/chat/ui/conversation_list_screen.dart` (route `/talk`, tab 1), `widgets/conversation_row.dart`; ARB `chat_list_*` from `ChatList.dc.html`.
**Steps** — 1. Top: two big buttons "কম্পন" (amber, `/buzz`) and "ভিডিও" (green, call picker sheet). 2. Rows: 56 dp avatar (group = overlapped three avatars), title 18 bold, preview 15 with a 20 dp type icon (text bubble, mic, camera, vibration, receipt, phone) and the word for non-text kinds ("ভয়েস মেসেজ ০:১২", "ভিডিও", "কম্পন", "খরচ"), time in words, green unread badge with Bangla digits and bold title when unread. 3. Presence dot on direct rows. 4. Tap → `/talk/:conversationId`. 5. Empty state: "এখনও কোনো কথা হয়নি" + "কম্পন দিন".
**Contract** — none.
**Tests** — `conversation_list_test.dart`: sorted by `lastAt desc`; unread badge "২"; preview icons by kind; golden `F1_chat_list.png`, `F1_chat_list_dark.png`.
**Acceptance** — standard.
**Done when** — the tab badge and list agree.

### T-MOB-39 · Chat screen (`Chat`) — read side *(screen)*
- **Closes:** FR-CHAT-01, -03, -05, -08, FR-NUDGE-04/-07 (cards), FR-VNOTE-03 (bubble), FR-VMSG-01 (bubble)
- **Depends on:** T-MOB-37, T-MOB-06
- **Milestone:** M3
- **Layer:** mobile
**Why** — The family thread with text, voice, video, buzz and expense cards.
**Files** — C `lib/features/chat/ui/chat_screen.dart` (route `/talk/:conversationId`), widgets `text_bubble.dart`, `voice_bubble.dart` (play button + waveform + "দাদির ভয়েস · ০:১৮"), `video_bubble.dart` (190×124 radius, play disc 56, caption "তানভীরের ভিডিও · ০:২৪"), `event_card.dart` (buzz amber tint, expense green tint, call, system), `day_chip.dart` ("আজ"), `receipt_label.dart`; ARB `chat_*` from `Chat.dc.html`.
**Steps** — 1. Header: back 48 dp, title "সবাই" 22 bold, subtitle member names 13, 56 dp green-tint video button. 2. Bubbles: others left with 36 dp avatar (radius 20/20/20/6, white with border, sender name 12 bold in avatar colour); mine right (green, white text, radius 20/20/6/20); 18 sp text; time 12 sp. 3. Receipt label on my last message in words: "পাঠানো হচ্ছে" / "পাঠানো হয়েছে" / "পৌঁছেছে" / "পড়েছে" (never ticks alone; ✓ ✓✓ may accompany). 4. Event cards: "আব্বু আম্মুকে কম্পন দিয়েছেন: খেতে আসুন" (amber tint, `#6B3F00`), "আম্মু খরচ লিখেছেন: বাজার ৳ ৮৫০" (green tint; tapping opens `/txn/:id` unless private-hidden), call cards "তানভীর ভিডিও কল করেছিলেন · ৫:২৩" / "মিস্ড কল". 5. Long-press a text bubble: sheet with "শুনুন" (TTS, FR-CHAT-08) and for mine within 24 h "সবার কাছ থেকে মুছুন". 6. Auto read-aloud of new incoming text when Simple mode is on and the screen is open. 7. Composer is in T-MOB-40. 8. Pagination: scroll up calls `loadOlder`. 9. On open and on each new message while visible call `markRead`.
**Contract** — none new.
**Tests** — `chat_screen_test.dart`: renders every bubble kind from the fake with exact strings above; day chip; receipt words; long-press sheet; TTS called with the message text; own message delete only within 24 h (using `FakeClock`); golden `Chat_thread.png`, `Chat_thread_dark.png`.
**Acceptance** — standard.
**Done when** — matches `Chat.dc.html`.

### T-MOB-40 · Chat composer, outbox, receipts, delete *(behaviour)*
- **Closes:** FR-CHAT-02, -03, -06, -07, AC-18
- **Depends on:** T-MOB-39, T-MOB-36
- **Milestone:** M3
- **Layer:** mobile
**Why** — Sending must be idempotent, ordered, and survive being offline.
**Files** — C `lib/features/chat/ui/composer.dart` (56 dp buzz button amber, 56 dp text field "এখানে লিখুন…", 64 dp green mic button for voice notes → `/voice-note/:conversationId`), C `lib/features/chat/data/outbox_worker.dart`, M `local_chat_repository.dart`.
**Steps** — 1. `sendText`: generate UUIDv4 `clientId`, insert a `Messages` row with `receipt: sending` and an `OutboxMessages` row in one transaction, then wake the worker. 2. `OutboxWorker`: processes rows in `createdAt` order per conversation (a failure blocks only that conversation), `POST /v1/conversations/:id/messages {id: clientId, body}`; success replaces the local row with the server row (same `clientId`, real `id`); `409` for an existing `clientId` is treated as success; network errors back off 2 s → 60 s; `4xx` other than 409/429 marks `failed` with a "আবার পাঠান" button on the bubble. 3. The worker runs on app start, on connectivity change, and after each enqueue. 4. Text longer than 2,000 chars is blocked in the composer with a counter ("২০০০ অক্ষরের বেশি লেখা যাবে না"). 5. Receipts: on `ReceiptEvent` update all my messages up to `upTo`. 6. Delete mine: `DELETE /v1/messages/:id` (≤ 24 h) → local row shows "মুছে ফেলা হয়েছে". 7. Typing indicator: send `typing` at most every 3 s while composing; show "{name} লিখছেন…" for 4 s after a `TypingEvent` (hidden when the sender hides presence).
**Contract** — SRS §8.2.
**Tests** — `outbox_worker_test.dart`: AC-18: same client id sent twice stores one message; offline messages are sent in order after reconnect (assert request order with a fake API); 409 treated as success; failure marks bubble failed and retry works; `composer_test.dart`: 2,000 limit; mic opens the voice note route.
**Acceptance** — `cd apps/mobile && flutter test test/features/chat`
**Done when** — airplane-mode compose → reconnect delivers in order.

### T-MOB-41 · Buzz: send screen (`2`) and repository (schema v8) *(screen)*
- **Closes:** FR-NUDGE-01, -04, -05, -06, -07, FR-BUD-06 (entry)
- **Depends on:** T-MOB-36, T-MOB-12, T-MOB-06
- **Milestone:** M3
- **Layer:** mobile
**Why** — Send a vibration with a phrase in three taps.
**Files**
- M `tables.dart` — `class NudgeLog extends Table { TextColumn get id => text()(); TextColumn get direction => text()(); /* sent|received */ TextColumn get otherUserId => text()(); TextColumn get phraseId => text()(); TextColumn get phraseText => text()(); TextColumn get intensity => text()(); TextColumn get state => text()(); TextColumn get createdAt => text()(); … primaryKey id }` and `class NudgePhrases extends Table { TextColumn get id => text()(); TextColumn get textBn => text()(); TextColumn get textEn => text()(); IntColumn get sort => integer()(); … }`; `schemaVersion => 8`; `if (from < 8) { createTable(nudgeLog); createTable(nudgePhrases); }`; dump `drift_schema_v8.json`; seed the 7 phrases locally so the screen works offline: খেতে আসুন, ফোন করুন, বাড়ি আসুন, খরচ লিখুন, ওষুধ খান, শুধু ডাকছি, বাজেট শেষ.
- C `lib/features/buzz/data/nudge_repository.dart` — `Future<NudgeReceipt> send({required List<String> recipientIds, required String phraseId, required Intensity intensity})` (REST `POST /v1/families/:id/nudges`), `Stream<NudgeState> watchState(String nudgeId)`, `Future<void> reply(String nudgeId, NudgeReply reply)`, `Future<void> markSeen(String nudgeId)`, `Future<List<Phrase>> phrases()` (cached; refresh `GET /v1/nudge-phrases`), fake + API.
- C `lib/features/buzz/ui/buzz_screen.dart` (route `/buzz`, `extra: BuzzArgs{recipientIds?, phraseId?}`), ARB `buzz_*` from `Buzz.dc.html`: "কম্পন পাঠান", "ফোন কাঁপবে, আওয়াজ ছাড়াই মনে করিয়ে দিন।", "কাকে?", "কী বলবেন?", intensity "কত জোরে?" with "আস্তে ·", "মাঝারি ··", "জোরে ···", send "{name}কে কম্পন পাঠান" (several: "{count} জনকে কম্পন পাঠান"), caption "{name}র ফোনে \"{phrase}\" লেখা দেখাবে এবং ফোন কাঁপবে।", quiet-hours note "চুপ সময়, পরে দেখবেন", rate-limit "একটু পরে আবার চেষ্টা করুন।", success "পাঠানো হয়েছে".
**Steps** — 1. Recipients row: 64 dp avatars with 4 dp ring + tick + bold name when selected (multi-select; at least one); presence dots. 2. Phrase grid 2 columns, 72 dp cells; selected = green tint + 3 dp green border (the design's "খেতে আসুন" state); each cell has an icon + phrase; tapping speaks the phrase quietly via TTS at low volume only if Simple mode. 3. Intensity: three 56 dp segments; default medium; show a **live preview vibration** (`Vibration.vibrate(pattern)`) when a segment is tapped. 4. Send: amber 72 dp pill; on success show "পাঠানো হয়েছে" and pop; the chat then displays the buzz card. 5. If the recipient's quiet hours apply (field `quietNow` returned by `GET /v1/families/:id/presence` per member) show the note before sending. 6. `429 nudge_rate_limited` → plain message. 7. Viewers can send buzz (SRS roles table).
**Contract** — `POST /v1/families/:id/nudges {recipientIds:[uuid], phraseId, intensity:'soft'|'medium'|'strong'}` → `{nudges:[{id, recipientId, state}]}`; `POST /v1/nudges/:id/reply {reply:'coming'|'later'|'call'}`.
**Tests** — `buzz_screen_test.dart`: default state matches the board (আম্মু selected, "খেতে আসুন", medium); multi-select count text; tapping a segment triggers the vibration fake with the exact pattern (soft `[0,200]`, medium `[0,300,150,300]`, strong `[0,500,200,500,200,500]`); send calls the repository once and pops; 429 shows the message; golden `2_buzz.png`; `migration_v7_to_v8_test.dart`.
**Acceptance** — standard.
**Done when** — matches `Buzz.dc.html`.

### T-MOB-42 · Vibration engine, FCM background handler, TTS on arrival
- **Closes:** FR-NUDGE-02, -08, FR-NOTIF-06, GAP-MOB-06 (part 2), AC-17
- **Depends on:** T-MOB-34, T-MOB-41
- **Milestone:** M3
- **Layer:** mobile
**Why** — A buzz must shake the phone even when the app is closed.
**Files**
- M `pubspec.yaml` add `vibration ^2.0.1`.
- C `lib/core/vibration/vibration_engine.dart` — `abstract class VibrationEngine { Future<bool> hasVibrator(); Future<void> play(Intensity i); Future<void> cancel(); }`, `DeviceVibrationEngine` (uses `Vibration.vibrate(pattern: …)` with patterns from `Intensity.pattern`), `RecordingVibrationEngine` (tests, records patterns) — `enum Intensity { soft([0, 200]), medium([0, 300, 150, 300]), strong([0, 500, 200, 500, 200, 500]) }`; call vibration uses a repeating pattern `[0, 800, 400, 800]` with `repeat: 0` until cancelled.
- C `lib/core/push/background_handler.dart` — `@pragma('vm:entry-point') Future<void> firebaseBackgroundHandler(RemoteMessage m)`: runs in its own isolate **without Riverpod or Drift**: (1) read quiet-hours prefs from `SharedPreferences` key `quiet_prefs` (mirrored there by `PreferencesController` because background isolates cannot open the encrypted store), (2) for `type == nudge` and not quiet: `DeviceVibrationEngine().play(intensity)`, (3) post a notification on channel `nudge` (id derived from `id`, full-screen intent to `amarporibar://buzz/<id>`, title "{from} আপনাকে কম্পন দিয়েছেন", body = phrase, `fullScreenIntent: true`, `category: 'call'`-style behaviour via `AndroidNotificationCategory.reminder`), (4) for `msg`/`budget`/`reminder` post a normal notification on its channel, (5) for `call` post on `calls` with the ringing vibration and full-screen intent to `amarporibar://call/<id>`. Idempotent per `id` (`SharedPreferences` set of the last 50 ids).
- C `lib/core/push/foreground_handler.dart` — when the app is open a `nudge` push or `NudgeEvent` plays the vibration directly and navigates to `/buzz/incoming/:id` via the router (no notification).
- C `lib/core/speech/nudge_speaker.dart` — speaks the phrase with `VoiceService.speak` when the incoming card opens (not in the background isolate) unless quiet hours.
- M `PreferencesController` — mirror `quietStart`, `quietEnd`, `quietEnabled` to `SharedPreferences`.
- C `android/app/src/main/res/raw/` none (no custom sound; channels are silent).
**Steps** — 1. Implement engine and handler. 2. Mark delivered: the background handler calls `POST /v1/nudges/:id/delivered` using the access token mirrored in `SharedPreferences('push_auth')`? **Not allowed** (tokens stay in secure storage): instead the app marks `delivered` when it next opens the card or syncs, and the server also marks `delivered` itself when FCM accepts the message for a device that acked a data message (backend T-COMM); the client only sends `seen`. 3. Respect quiet hours (silence both vibration and sound; the notification is posted without alert: `Importance.low` variant). 4. Deduplicate foreground vs background.
**Contract** — FCM `data` keys in T-MOB-34.
**Tests** — `vibration_engine_test.dart` (patterns exact; `cancel`), `background_handler_test.dart` (call the handler function directly with a fake plugin set: not quiet → vibration recorded with strong pattern and a notification on channel `nudge` with fullScreenIntent; quiet hours → no vibration, low-importance notification; duplicate id ignored; unknown type ignored), `foreground_handler_test.dart` (navigates to `/buzz/incoming/:id` and records the pattern), `integration_test/buzz_receive_test.dart` (AC-17, run on the CI Android emulator job: inject an FCM data message via `adb shell am broadcast`/the plugin test hook and assert the `RecordingVibrationEngine` pattern list and the route).
**Acceptance** — `cd apps/mobile && flutter test test/core/push test/core/vibration`; the emulator job `flutter test integration_test/buzz_receive_test.dart -d emulator-5554` (added to CI in T-MOB-75, `continue-on-error: false`).
**Done when** — AC-17 passes: right pattern for the chosen intensity and screen 6 shown.

### T-MOB-43 · Screen 6 incoming buzz, replies, full-screen intent and its permission guide *(screen)*
- **Closes:** FR-NUDGE-02, -03, -04, -08 (fallback), FR-VIDEO-04 (shared guide)
- **Depends on:** T-MOB-41, T-MOB-42
- **Milestone:** M3
- **Layer:** mobile
**Why** — A full-screen card with three large replies, working over the lock screen.
**Files** — C `lib/features/buzz/ui/incoming_buzz_screen.dart` (route `/buzz/incoming/:nudgeId`), `lib/features/buzz/ui/full_screen_guide.dart`, M `android/app/src/main/kotlin/com/raihan/amar_poribar/MainActivity.kt` (MethodChannel `ap/system`: `canUseFullScreenIntent()` → `NotificationManager.canUseFullScreenIntent()` on API 34+, `openFullScreenIntentSettings()` → `Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT`), M manifest (`MainActivity` `android:showWhenLocked="true" android:turnScreenOn="true"`), C `lib/core/system/system_channel.dart`; ARB `buzz_incoming_*` from `Incoming.dc.html`: "{name} আপনাকে কম্পন দিয়েছেন", phrase (44 sp bold), chip `"{phrase}" বলা হচ্ছে`, replies "আসছি", "পরে বলছি", "ফোন করি", guide "পর্দা বন্ধ থাকলেও কম্পন দেখতে অনুমতি দিন" with button "অনুমতি দিন".
**Steps** — 1. Full-screen amber (`#F2A33A`) card: pulsing double ring (animation 1.2 s, two rings at 240 dp and 184 dp, 25%/45% ink alpha; honours "reduce motion"), 128 dp avatar with 5 dp white border, then text per board, then buttons: "আসছি" 80 dp green full pill with 34 dp check, and two 64 dp outlined pills "পরে বলছি" / "ফোন করি" (3 dp ink border). 2. On open: `markSeen(nudgeId)`, `NudgeSpeaker` speaks the phrase, cancel the notification. 3. Replies call `NudgeRepository.reply`; "ফোন করি" starts a 1:1 call (T-MOB-69) if video is enabled else opens the phone dialer for the sender's number if known (`tel:` via `url_launcher`), else opens the chat. 4. After a reply pop to the previous route (or `/home` when launched cold). 5. If `canUseFullScreenIntent()` is false (Android 14+), on first receive show the guide once (`Meta('fsi_guide_shown')`) from Home as a `BannerStrip` and in Settings; the fallback heads-up notification keeps working.
**Contract** — `POST /v1/nudges/:id/seen`, `/reply`.
**Tests** — `incoming_buzz_screen_test.dart`: strings exact; "আসছি" calls reply `coming` and pops; speaker invoked once with the phrase; reduce-motion disables the pulse; quiet hours → no speech; guide shown only when `canUseFullScreenIntent` false and only once; `system_channel_test.dart` with a mock channel; golden `6_incoming_buzz.png`.
**Acceptance** — standard.
**Done when** — matches `Incoming.dc.html`; reply reaches the sender in the fake realtime server test (`NudgeStateEvent(replied)`).

### T-MOB-44 · Presence
- **Closes:** FR-PRES-01, FR-PRES-02, FR-CHAT-09 (dots)
- **Depends on:** T-MOB-36, T-MOB-12
- **Milestone:** M3
- **Layer:** mobile
**Why** — Show who is online with a dot **and** a word.
**Files** — C `lib/features/presence/data/presence_repository.dart` (`Stream<Map<String, Presence>> watch()`, `Future<void> setHidden(bool)`), C `lib/features/presence/state/presence_provider.dart`, M `lib/ui/member_avatar.dart` (reads `presenceProvider`), C `lib/core/l10n/relative_time.dart` (`lastSeenWords(DateTime, Locale)` → "আজ সকালে", "গতকাল", "৩ দিন আগে"; never exact times).
**Steps** — 1. Initial state from `GET /v1/families/:id/presence`; updates from `PresenceEvent`. 2. Hidden users appear offline and show no "last seen". 3. Labels: "অনলাইন" / "অফলাইন" (+ " · {city}" only for members who set a place label in profile, e.g. "রিয়াদ · অনলাইন"). 4. Own `presence.hide` sent when the preference changes.
**Contract** — presence `{userId, online, lastSeen?}`; hidden = `online:false` without `lastSeen`.
**Tests** — `presence_test.dart`: event flips dot within one frame; hidden user never shows last seen; `lastSeenWords` table of cases.
**Acceptance** — `cd apps/mobile && flutter test test/features/presence test/core/l10n`
**Done when** — Home, B4 and F1 show the same state.

### T-MOB-45 · Screen 4 Record a voice note and upload *(screen)*
- **Closes:** FR-VNOTE-01, -02, -04, AC-20, AC-21 (client)
- **Depends on:** T-MOB-40, T-MOB-72 (microphone permission explainer)
- **Milestone:** M3
- **Layer:** mobile
**Why** — Record, review and send a ≤ 60 s message.
**Files**
- M `pubspec.yaml` add `record ^5.1.2`, `just_audio ^0.9.40`.
- C `lib/core/audio/recorder_service.dart` — `abstract class RecorderService { Future<void> start(String path); Future<void> stop(); Stream<double> amplitude; Future<int> durationMs(String path); }`, `DeviceRecorderService` (`record` package, `AudioEncoder.aacLc`, `bitRate: 32000`, `sampleRate: 22050`, `numChannels: 1`, `.m4a`), `FakeRecorderService`.
- C `lib/features/chat/ui/voice_note_screen.dart` (route `/voice-note/:conversationId`), `lib/features/chat/data/media_uploader.dart` (`Future<MediaRef> upload(MediaKind, File, durationMs)` = `POST /v1/conversations/:id/voice-notes {durationMs, bytes, mime}` → presigned `PUT` → `POST /v1/voice-notes/:id/confirm`), fake; ARB `chat_voice_*` from `VoiceNote.dc.html`: "ভয়েস পাঠান", "সবাইকে পাঠানো হবে · সর্বোচ্চ ১ মিনিট", "রেকর্ড হচ্ছে", timer, "ফোনের কাছে মুখ রেখে বলুন", "পাঠানোর আগে একবার শুনে নিতে পারবেন।", "বাদ", "থামুন, শুনুন", consent notice "ভয়েস মেসেজ আমাদের সার্ভারে থাকবে, ১৮০ দিন পর মুছে যাবে।" with "বুঝেছি".
**Steps** — 1. First use: show the consent notice (FR-VNOTE-04), store acceptance via `POST /v1/me/consents {kind:'voice_notes'}` and `Meta('voice_consent')`; no recording starts before it. 2. Layout: white card radius 28 with red dot + "রেকর্ড হচ্ছে" (danger, 18 bold), timer 56 sp bold "০:১২" (numeral style), amplitude bars (15 bars drawn from `amplitude`, grey for remaining time up to 60 s), prompt line; info strip green tint; bottom: ✗ "বাদ" 96 dp circle danger outline and "থামুন, শুনুন" 96 dp green pill. 3. At 60 s auto-stop. 4. After stop show the review state: play/pause (reuse `VoicePlayer`), waveform, buttons "আবার রেকর্ড", "পাঠান" (primary). 5. Send: enqueue in `OutboxMessages` with `localMediaPath`; worker uploads (retry with the same presigned flow; new presign per attempt), then creates the message; the bubble shows "পাঠানো হচ্ছে". 6. Local pre-checks: duration ≤ 60 000 ms, bytes ≤ 600 000 → otherwise the screen refuses with "ভয়েস অনেক বড় হয়ে গেছে" before any network call (AC-21). 7. Delete the temp file after confirm or discard. 8. Max 40 uploads/day: server 429 shown plainly.
**Contract** — SRS §8.3.
**Tests** — `voice_note_screen_test.dart`: consent first; amplitude drives bars; auto-stop at 60 s with `fake_async`; > 600 KB file rejected locally without calling the uploader (AC-21); discard deletes the file; golden `4_voice_note.png`; `media_uploader_test.dart`: presign → PUT → confirm order; failure retries with fresh presign.
**Acceptance** — standard.
**Done when** — a recorded note appears as a voice bubble for the sender and is queued offline.

### T-MOB-46 · Voice note and video playback, media cache
- **Closes:** FR-VNOTE-03, FR-VMSG-01 (playback), NFR-19
- **Depends on:** T-MOB-39, T-MOB-37
- **Milestone:** M3
- **Layer:** mobile
**Why** — Tap to listen; auto-download only on Wi-Fi.
**Files** — C `lib/core/audio/voice_player.dart` (`just_audio` wrapper: `play(Uri|File)`, `pause`, `seek`, `setSpeed(1.0|1.5)`, `positionStream`, `stateStream`, single active player app-wide), C `lib/features/chat/data/media_cache.dart` (`Future<File?> cached(String mediaId)`, `Future<File> fetch(String mediaId)` via `GET /v1/media/:id` → short-lived URL → download into `getApplicationSupportDirectory()/media`, LRU eviction at 200 MB, updates `MediaCache`), M `voice_bubble.dart` (play 52 dp, waveform progress, speed chip "১×"/"১.৫×", duration), C `lib/core/net/network_kind.dart` (`connectivity_plus` → `wifi|mobile|none`), setting "ওয়াইফাইতে নিজে নামাবে" in Settings (default on).
**Steps** — 1. On bubble appearance: if Wi-Fi and setting on → prefetch; else show a "নামান" tap-to-download state with size ("০.৩ এমবি"). 2. Play resets other players. 3. Presigned URLs are never cached beyond 5 minutes; refetch on 403. 4. Voice bubble announces "ভয়েস মেসেজ, {sender}, {duration}" for screen readers.
**Contract** — `GET /v1/media/:id` → `{url, expiresAt}`.
**Tests** — `media_cache_test.dart` (LRU, prefetch rules), `voice_player_test.dart` (one player at a time, speed), `voice_bubble_test.dart` (states: remote, downloading, ready, playing).
**Acceptance** — `cd apps/mobile && flutter test test/features/chat test/core/audio`
**Done when** — AC-20 playback path works against `FakeMediaApi`.

### T-MOB-47 · B4 পরিবার tab: members, roles, invite, buzz and chat buttons *(screen)*
- **Closes:** FR-FAM-02, -03, -07, FR-PRES-01, FR-NAV-01
- **Depends on:** T-MOB-09, T-MOB-44, T-MOB-41
- **Milestone:** M3
- **Layer:** mobile
**Why** — The family tab lists people and lets you reach them.
**Files** — C `lib/features/family/ui/family_screen.dart` (route `/family`, tab 4), `widgets/member_row.dart`, `ui/invite_sheet.dart` ("নম্বর দিয়ে ডাকুন": phone field; "লিংক পাঠান (৭ দিন চলবে)": creates a link and opens the system share sheet via `share_plus`), `ui/role_sheet.dart` (change role, remove — only for Owner/Admin per `canAssignRole`/`canManageMember` ported to `lib/domain/models/role.dart`), `ui/transfer_ownership_sheet.dart`; ARB `fam_*` from `Members.dc.html`: "রহিম পরিবার", "{count} জন সদস্য · কম্পন বা কথা পাঠাতে ছবিতে চাপ দিন", role words "মালিক", "অ্যাডমিন", "সদস্য", "দর্শক · {place}", pending invite row "আমন্ত্রণ পাঠানো হয়েছে · {days} দিন বাকি", "+ নম্বর দিয়ে ডাকুন", "লিংক পাঠান (৭ দিন চলবে)".
**Steps** — 1. Rows: 48 dp avatar, name 17 bold, role pill, and two 48 dp circle buttons: amber "কম্পন" and green "কথা" (or "ভিডিও" for the viewer abroad); my own row has none. 2. Tapping a row's name opens the role sheet for Owner/Admin. 3. Plan limit: inviting beyond the limit shows `plan_member_limit` → routes to `/plans`. 4. Header gear → `/settings`. 5. Tab uses `AppBottomTabs` index 4. 6. Invite by phone calls `POST /v1/families/:id/invites {phone, role}`; link calls the same without phone and shares `https://amarporibar.app/join/<token>`.
**Contract** — `GET /v1/families/:id/members`, `PATCH`/`DELETE /members/:userId`, `POST /invites`, `POST /transfer-ownership`.
**Tests** — `family_screen_test.dart`: rows and role words exact; admin sees role sheet, member does not; viewer row shows video button; invite beyond limit routes to plans; golden `B4_family.png`, `B4_family_dark.png`.
**Acceptance** — standard.
**Done when** — matches `Members.dc.html`.

---

## M4 · Offline, background sync, Simple mode, accessibility

### T-MOB-48 · Background sync (WorkManager) and automatic triggers
- **Closes:** FR-SYNC-06, AC-23, GAP-MOB-09
- **Depends on:** T-MOB-11, T-MOB-24
- **Milestone:** M4
- **Layer:** mobile
**Why** — Sync must not depend on the user pressing a button.
**Files**
- M `pubspec.yaml` add `workmanager ^0.5.2`, `connectivity_plus ^6.1.0`.
- C `lib/data/sync/sync_scheduler.dart` — `SyncScheduler` with `requestSoon()` (debounced 5 s), `registerPeriodic()` (15 min, `NetworkType.connected`, `existingWorkPolicy: keep`), `runNow()`; triggers: app start, resume, connectivity regained, after each local write (hook in `LocalStore` via callback), manual (F4), push `type == sync`.
- C `lib/data/sync/background_sync.dart` — top-level `@pragma('vm:entry-point') void callbackDispatcher()` for WorkManager: opens `AppDatabase.open()` and `SecureTokenStore` directly (no Riverpod), runs `ReferenceDataSync` + `SyncService.sync(activeFamilyId)` + `OutboxWorker.flush()` + `PendingQueue.flush()`, returns `true` on success, `false` (retry with back-off) on network error, `true` on auth expiry (and writes `Meta('session_expired')=1` so the app shows F6).
- C `lib/data/sync/sync_state.dart` — `SyncStateNotifier` (`idle|syncing|offline|error`, `pendingCount`, `lastSyncedAt`, `lastError`) exposed as `syncStateProvider` (used by Home banner and F4).
- M `lib/data/sync/sync_service.dart` — never throws to UI: returns `SyncSummary`; guarded by a mutex so UI-triggered and worker-triggered syncs never overlap (`Meta('sync_lock')` with a 2-minute timeout since the isolates differ).
- M `android/app/src/main/AndroidManifest.xml` — WorkManager provider is auto-registered; add `FOREGROUND_SERVICE` not needed.
**Steps** — 1. Implement scheduler, worker and state. 2. Remove the manual "সার্ভারের সাথে সিঙ্ক" call from Settings (T-MOB-33). 3. On sign-out cancel all work. 4. Time budget: a run aborts after 8 minutes. 5. The debounced trigger after local writes uses the real clock injected for tests.
**Contract** — unchanged sync endpoint (SRS §9).
**Tests** — `sync_scheduler_test.dart` with `fake_async`: three writes within 5 s cause one `sync`; regaining connectivity triggers a run; `background_sync_test.dart` calling the dispatcher function with in-memory fakes (success → true; network error → false; 401 → true + expired flag); `sync_state_test.dart`; AC-23 equivalent: offline write, connectivity event, `FakeSyncApi` receives the row within 20 s of fake time.
**Acceptance** — `cd apps/mobile && flutter test test/data/sync`
**Done when** — a phone left idle syncs without opening the app screen.

### T-MOB-49 · F4 Offline status, nearby sync list, queued AI items *(screen)*
- **Closes:** FR-SYNC-03, -04, -07, AC-25
- **Depends on:** T-MOB-48, T-MOB-06
- **Milestone:** M4
- **Layer:** mobile
**Why** — Tell people in plain words whether their data is safe and synced.
**Files** — C `lib/features/sync/ui/sync_status_screen.dart` (route `/sync`), `widgets/nearby_device_tile.dart`, `widgets/queued_ai_tile.dart`, M `lib/data/sync/peer_sync_engine.dart` (expose `Stream<List<NearbyDevice>>` and `Future<void> syncWith(deviceId)` for the UI; the engine and Nearby transport already exist), M `lib/features/home/ui/home_screen.dart` (offline `BannerStrip` "অফলাইনে আছেন · {count}টি খরচ জমা আছে" tapping to `/sync`), ARB `sync_*` from `SyncStatus.dc.html`.
**Steps** — 1. Top card: status words "অফলাইনে আছেন · ৩টি খরচ জমা আছে" / "সব ঠিক আছে · শেষ সিঙ্ক আজ সকালে" (relative words, never exact time), big "এখনই সিঙ্ক করুন" 64 dp (disabled offline), reassurance text "কোনো তথ্য হারাবে না। ইন্টারনেট এলে নিজে থেকেই যাবে।". 2. Nearby section: switch "কাছের ফোনের সাথে সিঙ্ক" (permissions flow T-MOB-72), list of found devices with the 4-digit auth code both phones show ("কোড {code} মিলছে?" with big হ্যাঁ/না) and status words ("খুঁজছে…", "সংযুক্ত", "সিঙ্ক হয়েছে"). 3. Queued AI: each `PendingEntries` row (queued/ready/failed) as a tile "কথা থেকে খসড়া: ইন্টারনেট এলে বুঝে নেব" with delete and, when `ready`, "দেখুন" opening the draft (FR-SYNC-03). 4. Rejected rows (`duplicate_trx_id`, `forbidden`, `unknown_reference`) listed with a plain explanation and "ঠিক করুন"/"মুছুন". 5. Section "শেষ সিঙ্কের ফলাফল" (pushed / pulled counts in words).
**Contract** — none.
**Tests** — `sync_status_screen_test.dart`: AC-25 offline text with pending count; online text; nearby auth code confirm; queued AI tile; rejected list; golden `F4_sync_status.png`.
**Acceptance** — standard.
**Done when** — matches `SyncStatus.dc.html`.

### T-MOB-50 · Simple mode and D3 home *(screen)*
- **Closes:** FR-VOICE-09, FR-HOME-01 (variant), AC-11
- **Depends on:** T-MOB-23, T-MOB-31, T-MOB-28, T-MOB-06
- **Milestone:** M4
- **Layer:** mobile
**Why** — One huge mic, four picture tiles, everything spoken.
**Files** — C `lib/features/home/ui/simple_home_screen.dart`, C `lib/features/settings/state/ui_mode.dart` (`uiModeProvider` combining preference + `UiScale`, applies text scale 1.3 via `MediaQuery.copyWith(textScaler:)` at the app root), M `lib/app/app.dart` (apply), M `lib/ui/*` (every widget reads `UiScale`), C `lib/core/speech/auto_speak.dart` (`AutoSpeaker`: a widget `AutoSpeak(text:)` that speaks once per appearance when Simple mode is on), ARB `simple_*` from `SimpleHome.dc.html`: "বলুন", tiles "কম্পন", "কথা", "মাসের কথা শুনুন", "খরচ দেখুন", badge "সব কিছু শুনিয়ে দেবে", link "সাধারণ মোডে যান".
**Steps** — 1. Layout: huge 104+ dp mic (minimum 160 dp circle in this mode) centred, below it a 2×2 grid of 112 dp picture tiles (icon 48 dp + label 20 sp bold), top-right small "সাধারণ মোডে যান" 56 dp text button. 2. All primary controls ≥ 72 dp (assert in the semantics harness). 3. Auto read-aloud: draft read-backs (A3), summary (B2), incoming chat text, notifications items, errors. 4. Nav tabs hidden on this screen; other screens keep the tab bar with 28 dp icons and 14 sp labels. 5. Entering Simple mode from Welcome/Profile/Settings applies immediately; leaving restores normal.
**Contract** — preference `simpleMode` stored locally and synced via `PATCH /v1/me`.
**Tests** — `simple_home_test.dart`: only four tiles + mic + link; sizes ≥ 72; AC-11: the add-expense-by-voice flow (fake transcript "বাজার আটশো টাকা") and the summary Listen flow complete using only widgets with `size >= Size(72, 72)` and Bangla semantics labels (`expectAllTappablesLabelled(tester, minSize: 72)`); auto-speak invoked for read-back; golden `D3_simple_home.png`.
**Acceptance** — standard.
**Done when** — AC-11 passes.

### T-MOB-51 · Accessibility audit harness
- **Closes:** FR-A11Y-01, -02, NFR-10, NFR-16
- **Depends on:** T-MOB-06
- **Milestone:** M0 (do early) — used by every screen task
- **Layer:** mobile
**Why** — Enforce labels and sizes automatically instead of by review.
**Files** — C `test/a11y/a11y_helpers.dart` — `Future<void> expectAllTappablesLabelled(WidgetTester t, {Size minSize = const Size(48, 48), Size primaryMin = const Size(56, 56)})`: walks the semantics tree (`t.getSemantics(find.byType(Scaffold))` recursively), for every node with `SemanticsAction.tap` asserts (a) non-empty `label` containing at least one Bangla character (U+0980–U+09FF) unless the label is in an allow-list of brand words, (b) rendered size ≥ `minSize`, (c) nodes flagged by `Semantics(container:true, identifier:'primary')` (the `BigButton` sets this) ≥ `primaryMin`; `expectNoColourOnlyStatus(t)` finds `StatusChip` widgets and asserts each contains an `Icon` and non-empty text; `expectContrast(t)` samples text style colours against their scaffold background using `AppTokens.textPairs`.
- C `test/a11y/screens_a11y_test.dart` — registry loop: for each route in `Routes` with a registered `ScreenFactory` (screen tasks append one line to `test/a11y/screen_registry.dart`) pump it with `pumpApp` in normal and Simple mode and run all helpers.
- C `test/a11y/screen_registry.dart`.
**Steps** — 1. Write helpers. 2. Add `Semantics` wrappers inside `BigButton`, `IconTile`, `BigMicButton`, `ListenButton`, `MemberAvatar` (button semantics with label). 3. Add the registry with an entry per screen task. 4. Add `a11y` to the standard acceptance command.
**Contract** — a screen registers itself by one line: `registerScreen('B1', Routes.list, (c) => TransactionsScreen(), needs: [transactionRepositoryProvider.overrideWithValue(FakeTransactionRepository())])`.
**Tests** — `a11y_helpers_test.dart`: a widget with an unlabeled `GestureDetector` fails the check; a 40 dp button fails; an English-only label fails; a labelled 56 dp button passes.
**Acceptance** — `cd apps/mobile && flutter test test/a11y`
**Done when** — adding a screen without a registry entry fails `test/a11y/registry_complete_test.dart` (it compares `Routes` to the registry and the screen catalogue list in `docs/design/screens.json`).

### T-MOB-52 · Golden test infrastructure and design sources
- **Closes:** NFR-24
- **Depends on:** T-MOB-03, T-MOB-13
- **Milestone:** M0 (do early)
- **Layer:** mobile + docs
**Why** — Screens must look like the design; CI should prove it within 2%.
**Files**
- C `docs/design/screens/*.dc.html` — copies of the 52 design boards (from the design canvas export; the task script `tool/fetch_design.dart` downloads nothing — the files are committed by this PR from `docs/design/screens/`) and `docs/design/screens.json` listing `{code, file, title, requirement, platform}` for every board (generated from SRS §5.1.3).
- C `apps/mobile/test/goldens/golden_config.dart` — `kGoldenSize = Size(390, 844)`, `ToleranceComparator(0.02)` (a `GoldenFileComparator` subclass wrapping `LocalFileComparator` that fails only when pixel difference ratio > 2%), `Future<void> goldenScreen(String name, Widget screen, {List<Override> overrides, bool dark = false, UiScale scale})` using `alchemist`'s `goldenTest` with `GoldenTestGroup`, CI goldens on (`AlchemistConfig(platformGoldensConfig: disabled, ciGoldensConfig: enabled)`), bundled Hind Siliguri.
- C `apps/mobile/test/goldens/README.md` — how to update goldens: `flutter test --update-goldens test/goldens/<file>`; goldens are regenerated only inside the pinned CI image (`ghcr.io/cirruslabs/flutter:<pinned>`) via `tool/update_goldens.sh` so fonts/rasterisation are identical.
- M `.github/workflows/ci.yml` — mobile job pins Flutter version (`flutter-version: <from pubspec.lock / .fvmrc>`), runs `flutter test test/goldens`; on failure uploads `test/goldens/failures/**` as an artifact.
- C `apps/mobile/.fvmrc` pinning the version.
**Steps** — 1. Implement helpers. 2. Add one sample golden for `AppBottomTabs` (T-MOB-06) to prove the pipeline. 3. Commit design sources and `screens.json`.
**Contract** — golden file name `<code>_<name>.png`, dark `<code>_<name>_dark.png`.
**Tests** — `test/goldens/tabs_golden_test.dart`; `test/goldens/tolerance_test.dart` (1.9% difference passes, 2.1% fails).
**Acceptance** — `cd apps/mobile && flutter test test/goldens` and `test -f docs/design/screens.json`
**Done when** — every screen task can add a golden with one call.

### T-MOB-53 · F2 Switch family *(screen)*
- **Closes:** FR-FAM-04
- **Depends on:** T-MOB-12, T-MOB-06
- **Milestone:** M4
- **Layer:** mobile
**Why** — Households and parents' households.
**Files** — C `lib/features/family/ui/family_switch_screen.dart` (route `/families`, opened from the Home header family name and Profile), ARB `fam_switch_*` from `FamilySwitch.dc.html`, M `family_list_repository.dart` (counts: unread chat, open alerts from `CachedBudgets` levels).
**Steps** — 1. Cards per family with role chip, unread badge, alert count in words ("২টি সতর্কতা"). 2. Selecting sets `activeFamilyIdProvider`, shows a brief "বদলানো হয়েছে" and goes to `/home`. 3. "+ নতুন পরিবার" → `/consent` step in create-only mode; "আমন্ত্রণ নিয়ে যোগ দিন" → paste-link field → `/join/:token`. 4. The realtime client re-auths for the new family (T-MOB-36).
**Contract** — none.
**Tests** — `family_switch_test.dart`: switching clears family-scoped providers; counts; golden `F2_family_switch.png`.
**Acceptance** — standard.
**Done when** — two families on one device never mix data (assert in `test/features/family/isolation_test.dart` with two fake families).

---

## M7 · P2 screens (money setup, receipts, Ask, bazaar, privacy)

Board files named below hold the exact Bangla and sizes; each task's golden is the arbiter. Strings are copied into ARB with the key prefix given.

### T-MOB-54 · E1 Accounts and balances *(screen)*
- **Closes:** FR-ACC-01..04
- **Depends on:** T-MOB-11, T-MOB-06 (backend T-LED accounts with balances)
- **Milestone:** M7
- **Layer:** mobile
**Why** — Cash, bKash, Nagad, bank, card with running balances.
**Files** — C `lib/features/accounts/ui/accounts_screen.dart` (route `/accounts`), `ui/account_edit_sheet.dart`, `data/account_repository.dart` (`Stream<List<Account>> watch()`, `create`, `update`, `archive` → `POST/PATCH /v1/families/:id/accounts`; Admin/Owner only), fake with the board's data (ক্যাশ, আম্মুর বিকাশ owned by আম্মু, নগদ, ব্যাংক, কার্ড); ARB `acct_*` from `Accounts.dc.html`.
**Steps** — 1. Rows: type icon + word (ক্যাশ, বিকাশ, নগদ, রকেট, উপায়, ব্যাংক, কার্ড, অন্যান্য), name, owner chip ("আম্মুর" or "সবার"), balance 20 bold (negative in danger with "−"). 2. "+ নতুন অ্যাকাউন্ট": type chips (8), name, opening balance (keypad), owner picker. 3. Archive instead of delete (confirmation sheet with plain text). 4. Balances come from the server's computed values cached in `CachedAccounts.balancePaisa`; offline shows "শেষ হিসাব অনুযায়ী" caption and adds local unsynced transactions to the displayed balance (`balance + Σ local unsynced`). 5. Members/viewers see read-only.
**Contract** — account `{id,name,type,ownerUserId,openingBalancePaisa,balancePaisa,archived}`.
**Tests** — `accounts_screen_test.dart`: rows, role gating, offline balance adjustment, create flow calls repository with `type: 'bkash'`; golden `E1_accounts.png`.
**Acceptance** — standard.
**Done when** — matches `Accounts.dc.html`.

### T-MOB-55 · E2 Categories *(screen)*
- **Closes:** FR-CAT-01..03, FR-CAT-02
- **Depends on:** T-MOB-29, T-MOB-11
- **Milestone:** M7
- **Layer:** mobile
**Why** — Add, rename, hide and choose an icon.
**Files** — C `lib/features/categories/ui/categories_screen.dart` (route `/categories`), `ui/category_edit_sheet.dart` (name bn/en fields, icon grid of the 20 icons), `data/category_repository.dart` (`POST/PATCH /v1/families/:id/categories`), fake; ARB `cat_*` from `Categories.dc.html` (tabs "খরচ" / "আয়", "লুকানো", "+ নতুন খাত").
**Steps** — 1. Grid like A4 with an eye-off icon + word "লুকানো" on hidden ones. 2. Tap opens the edit sheet (rename, icon, hide). 3. Default categories cannot be deleted, only hidden; custom ones can be hidden too (no delete in P2). 4. Refresh `CachedCategories` after each change and invalidate pickers.
**Contract** — category `{id,key,kind,nameBn,nameEn,icon,isHidden}`.
**Tests** — `categories_screen_test.dart`: tabs, hide toggles pickers (A4 no longer shows it), icon change persists; golden `E2_categories.png`.
**Acceptance** — standard.
**Done when** — hidden categories vanish from A4/D4.

### T-MOB-56 · E3 Recurring bills and reminders *(screen)*
- **Closes:** FR-REC-01..03, FR-TXN-06, FR-NOT-03
- **Depends on:** T-MOB-35, T-MOB-26
- **Milestone:** M7
- **Layer:** mobile
**Why** — Rent, helper's pay and subscriptions as monthly drafts.
**Files** — C `lib/features/recurring/ui/recurring_screen.dart` (route `/recurring`), `ui/recurring_edit_sheet.dart`, `data/recurring_repository.dart` (`GET/POST/PATCH /recurring`, `GET /recurring/drafts`, `POST /recurring/:id/confirm`, `POST /recurring/:id/skip`), fake; ARB `rec_*` from `Recurring.dc.html`.
**Steps** — 1. List with day of month words ("প্রতি মাসের ৫ তারিখ"), amount, remind chip "২ দিন আগে মনে করান". 2. "এ মাসের খসড়া" card: "বাসা ভাড়া ৳১২,০০০ দেওয়া হয়েছে?" with big ✓ (confirm → creates the transaction locally with the template's category/account, `source: manual`, and calls confirm) and ✗ (skip). 3. Local reminder fallback when push unavailable (T-MOB-35 scheduler). 4. Confirm once per month: if the server says `already_confirmed`, the card disappears.
**Contract** — template `{id,name,type,amountPaisa,categoryId,accountId,dayOfMonth,startsOn,endsOn,remindDaysBefore,active}`.
**Tests** — `recurring_screen_test.dart`: draft ✓ adds one transaction (idempotent on double tap), ✗ skips, edit flow; golden `E3_recurring.png`.
**Acceptance** — standard.
**Done when** — matches `Recurring.dc.html`.

### T-MOB-57 · E4 Festival budget *(screen)*
- **Closes:** FR-BUD-04
- **Depends on:** T-MOB-32
- **Milestone:** M7
- **Layer:** mobile
**Why** — A one-off Eid budget with a suggested split.
**Files** — C `lib/features/budgets/ui/festival_new_screen.dart` (route `/festival/new`), `data/festival_repository.dart` (`/festival-budgets` CRUD), fake; ARB `fest_*` from `FestivalNew.dc.html`.
**Steps** — 1. Fields: name (default "ঈদুল আযহা"), date range (two big date pickers), amount keypad. 2. Suggested split bars by category (পশু, বাজার, কাপড়, দান) with ± steppers of ৳ 500 (no sliders: big buttons); total must equal the amount. 3. Save → shows on B3.
**Contract** — `{id,name,startsOn,endsOn,limitPaisa}` (split is client advice, not stored in P2).
**Tests** — `festival_new_test.dart`: split sums to the total; end before start blocked with a message; golden `E4_festival.png`.
**Acceptance** — standard.
**Done when** — festival card appears on B3 after save.

### T-MOB-58 · E5 Reports: member, account, trend *(screen)*
- **Closes:** FR-REP-01..04, GAP-MOB (reports)
- **Depends on:** T-MOB-24, T-MOB-06
- **Milestone:** M7
- **Layer:** mobile
**Why** — See where money went by category, person and account, and the 6/12-month trend.
**Files** — C `lib/features/reports/ui/reports_screen.dart` (route `/reports`), `widgets/bar_list.dart` (horizontal CSS-like bars drawn with `Container`, no chart library), `widgets/trend_bars.dart` (vertical bars; `fl_chart` is already a dependency and may be used for the trend), `data/report_repository.dart` (offline: computed from the local DB; online: `GET /reports/summary` and `/reports/trend?months=6|12`), fake; ARB `rep_*` from `Reports.dc.html` (segments "খাত", "সদস্য", "অ্যাকাউন্ট"; "৬ মাস" / "১২ মাস"; "গত মাসের চেয়ে"; "CSV নিন").
**Steps** — 1. Segmented control (3 × 56 dp). 2. Each bar row shows name, amount and a percentage **in words** ("প্রায় অর্ধেক") not only %, per the plain-language rule. 3. Trend with value labels under each bar (month name + amount). 4. Private entries are included only for me (local query uses `includePrivateOf(me)`). 5. CSV export for the chosen range (shared with `share_plus`). 6. Viewer role sees category totals only (no member breakdown).
**Contract** — trend `[{month:'YYYY-MM', totalPaisa, byCategory?:[…]}]` with zeros for empty months.
**Tests** — `reports_screen_test.dart`: segment switching; percentages words; CSV content; viewer restriction; golden `E5_reports.png`.
**Acceptance** — standard.
**Done when** — AC-38 client rendering handles zero months.

### T-MOB-59 · E6 Viewer / Probashi remittance view *(screen)*
- **Closes:** FR-FAM-05, FR-REP-05, BR-13
- **Depends on:** T-MOB-23, T-MOB-58
- **Milestone:** M7
- **Layer:** mobile
**Why** — The family member abroad sees summaries and stays in touch, without individual entries.
**Files** — C `lib/features/reports/ui/remit_screen.dart` (route `/remit`; for viewers it replaces the Home money card), `data/remittance_repository.dart` (`GET /reports/remittances?from&to`), fake; ARB `remit_*` from `Remit.dc.html`.
**Steps** — 1. Banner "আপনি শুধু দেখতে পারবেন" (green tint); remittance sent this month (৳ ৪০,০০০) vs spent by category; running balances per account; month list. 2. Buttons: "পরিবারকে কম্পন দিন" (amber, `/buzz`) and "ভিডিও কল" (green). 3. No add-expense affordance anywhere; router guard sends viewers away from `/add*` routes.
**Contract** — remittances `[{month, remittancePaisa, expensePaisa}]`.
**Tests** — `remit_screen_test.dart`: viewer sees banner and no add button; golden `E6_remit.png`.
**Acceptance** — standard.
**Done when** — a viewer user can reach only read-only money screens.

### T-MOB-60 · D6 Receipt photo → draft, attach, split *(screen)*
- **Closes:** FR-AI-09, FR-TXN-07, FR-TXN-08, AC-36 (client)
- **Depends on:** T-MOB-28, T-MOB-26, T-MOB-72 (camera permission)
- **Milestone:** M7
- **Layer:** mobile
**Why** — Photograph a bazaar memo and save the lines.
**Files**
- M `pubspec.yaml` add `image_picker ^1.1.2`, `flutter_image_compress ^2.3.0`, `camera ^0.11.0`.
- C `lib/features/receipt/ui/receipt_screen.dart` (route `/receipt`), `data/receipt_repository.dart` (`Future<ReceiptResult> parse(File compressedJpeg)` → `POST /ai/receipt` as base64 per `ReceiptRequestSchema`; `Future<void> attach(String txnId, File)` → `POST /transactions/:id/attachment` presign + `PUT`), fake (the board's two lines: বাজার ৳৬২০, ওষুধ ৳২৩০), ARB `receipt_*` from `Receipt.dc.html`.
**Steps** — 1. Capture via `image_picker` camera (or gallery). 2. Compress on device to ≤ 300 KB JPEG (max edge 1600 px, quality stepping 80 → 50) with `flutter_image_compress` and verify `bytes <= 300 * 1024` before upload. 3. Show the photo preview, parsed lines grouped by category (editable amount and category per line via the A4 picker), total, read-back button, ✓ save / ✗ discard, toggle "ছবি রাখুন" (attach). 4. Save creates **one** transaction when one category, or a split group: parent with `splitGroupId` and child transactions whose amounts sum to the parent (parent amount is the sum; block save if sums differ). 5. Offline: queue the photo in `PendingEntries` with `source: receipt` and a local file path; process online (shown in F4). 6. Quota exhausted → `ai_quota` card (T-MOB-65).
**Contract** — receipt result `{lines:[{text,amountPaisa,categoryKey?}],totalPaisa,confidence}`.
**Tests** — `receipt_screen_test.dart`: AC-36 client: three lines sum to the parent; mismatch blocks save; compression helper rejects > 300 KB result; attach toggle uploads once; golden `D6_receipt.png`.
**Acceptance** — standard.
**Done when** — a photo becomes a split group saved locally.

### T-MOB-61 · D7 Category learning prompt *(screen/sheet)*
- **Closes:** FR-AI-07, AC-35 (client)
- **Depends on:** T-MOB-28, T-MOB-29
- **Milestone:** M7
- **Layer:** mobile
**Why** — After correcting a category, offer to remember it.
**Files** — C `lib/features/entry/ui/rule_learn_sheet.dart` and `ui/learned_rules_screen.dart` (route `/rule-learn`), `data/merchant_rule_repository.dart` (`GET/POST/DELETE /merchant-rules`), fake; ARB `rule_*` from `RuleLearn.dc.html` ("এরপর থেকে '{merchant}' সবসময় {category}য় রাখব?", big "হ্যাঁ"/"না").
**Steps** — 1. Trigger: user saved a draft with a category different from the suggestion and a recognisable merchant (counterparty or first word of note ≥ 3 letters). 2. "হ্যাঁ" creates a rule (`POST`) with `pattern` normalised lowercase; "না" never asks again for that pair in this session. 3. `learned_rules_screen` lists rules with delete. 4. Offline: rule creation queued in `Meta('rule_queue')`.
**Contract** — rule `{id,pattern,categoryId}`.
**Tests** — `rule_learn_test.dart`: prompt appears only on a changed category; yes posts once; list delete; golden `D7_rule_learn.png`.
**Acceptance** — standard.
**Done when** — AC-35 client path creates the rule.

### T-MOB-62 · B5 Ask by voice *(screen)*
- **Closes:** FR-VOICE-08, FR-AI-10
- **Depends on:** T-MOB-22, T-MOB-06
- **Milestone:** M7
- **Layer:** mobile
**Why** — Ask "এই মাসে বাজারে কত খরচ হলো?" and hear the answer.
**Files** — C `lib/features/ask/ui/ask_screen.dart` (route `/ask`), `data/ask_repository.dart` (`POST /ai/ask {question}` → `{answer, speechText, figures}`), fake, ARB `ask_*` from `Ask.dc.html`.
**Steps** — 1. Chat-like thread (my question green bubble right, answer white card left with the figures bold, "আবার শুনুন" 56 dp pill, caption "ব্যক্তিগত খরচ এখানে ধরা হয়নি।"). 2. Huge 104 dp amber mic with 8 dp halo: **hold to talk** (`onLongPressStart` starts `listen`, release stops), caption "চেপে ধরে বলুন", alternative "লিখে জিজ্ঞেস করুন" opens a text field. 3. Suggested question chips (52 dp). 4. Speak the answer automatically (always in Simple mode; otherwise a "শুনুন" button). 5. Plan gate: Ask is Plus-only; on `plan_required` show the upgrade card (T-MOB-65).
**Contract** — `POST /v1/families/:id/ai/ask`.
**Tests** — `ask_screen_test.dart`: hold gesture lifecycle with the fake voice service; answer spoken; quota/plan errors; golden `B5_ask.png`.
**Acceptance** — standard.
**Done when** — matches `Ask.dc.html`.

### T-MOB-63 · F5 Shared bazaar list *(screen, schema v9)*
- **Closes:** FR-SHOP-01..03, AC-37 (client)
- **Depends on:** T-MOB-36, T-MOB-26, T-MOB-28
- **Milestone:** M7
- **Layer:** mobile
**Why** — A family shopping list that turns into an expense.
**Files**
- M `tables.dart` — `class ShoppingLists extends Table { id, familyId, name, archivedAt }`, `class ShoppingItems extends Table { id, listId, name, qtyText, estPricePaisa (int nullable), addedBy, checkedBy (nullable), checkedAt (nullable), position (int), updatedAt }`; `schemaVersion => 9`; `if (from < 9) { createTable(shoppingLists); createTable(shoppingItems); }`; dump `drift_schema_v9.json`.
- C `lib/features/shopping/data/shopping_repository.dart` (`Stream<List<ShoppingItem>> watch(listId)`, `add(name, qty, price?)`, `toggle(id)`, `remove(id)`, `toExpenseDraft(listId)`; implements `CatchUp`; REST `/shopping-lists/*` + `ShoppingItemEvent`; last-write-wins per item by `updatedAt`; offline queue in `Meta('shopping_queue')`), fake, `ui/bazaar_screen.dart` (route `/bazaar`), ARB `shop_*` from `Bazaar.dc.html`.
**Steps** — 1. Checklist rows 64 dp (big checkbox 40 dp), name 18, qty and price 14 muted, "কে যোগ করেছে" avatar. 2. Add by typing or mic ("চাল দুই কেজি" parsed by a small local splitter: name, qty words). 3. Total of estimated prices for checked items; "বাজারে খরচ লিখুন" opens D4 prefilled (category বাজার, amount = sum, note = item names). 4. Real-time: `ShoppingItemEvent` updates Drift within 1 s. 5. "তালিকা শেষ" archives; keeps last 10.
**Contract** — item `{id,listId,name,qtyText,estPricePaisa,addedBy,checkedBy,checkedAt,position,updatedAt}`.
**Tests** — `shopping_test.dart`: AC-37 client: event from a second client appears; toggle offline then sync order; to-expense sum; `migration_v8_to_v9_test.dart`; golden `F5_bazaar.png`.
**Acceptance** — standard.
**Done when** — two fake clients stay in sync through `FakeRealtimeServer`.

### T-MOB-64 · F7 Delete my data and export *(screen)*
- **Closes:** FR-AUTH-05, FR-PRIV-03, FR-PRIV-04, AC-27/28 (client)
- **Depends on:** T-MOB-20
- **Milestone:** M5
- **Layer:** mobile
**Why** — A person can download and erase their data.
**Files** — C `lib/features/privacy/ui/delete_account_screen.dart` (route `/delete-account`), `data/privacy_repository.dart` (`POST /me/export`, `GET /me/export/:id` (status + link), `POST /me/erasure {confirmLast3}`, `DELETE /me/erasure`), fake, ARB `priv_*` from `DeleteAccount.dc.html`.
**Steps** — 1. Two columns of words: what will be deleted / what stays ("পরিবারের হিসাবে আপনার লেখা খরচ থাকবে, নাম ছাড়া"). 2. "আগে আমার তথ্য ডাউনলোড করুন": request export, show progress words, when ready open the link with `url_launcher` (external). 3. Owner warning: if I am the owner and others exist, block with "আগে মালিকানা অন্য কাউকে দিন" + button to B4 transfer sheet. 4. Confirm: type the **last 3 digits of my phone** (numeral style aware) → red 56 dp button "মুছে ফেলুন"; success screen "৩০ দিনের মধ্যে মুছে যাবে। আবার ঢুকলে বাতিল হবে।"; the app signs out locally but keeps the pending-erasure banner on next login ("বাতিল করুন"). 5. Red button is never the largest.
**Contract** — erasure `{status:'scheduled', dueAt}`.
**Tests** — `delete_account_test.dart`: wrong digits keep the button disabled; owner block; export status polling; sign-out after scheduling; cancel on login; golden `F7_delete_account.png`.
**Acceptance** — standard.
**Done when** — AC-28 client flow ends signed out with a scheduled request in the fake.

### T-MOB-65 · E7 Plans, payment and AI-quota card *(screen)*
- **Closes:** FR-BILL-01..06, FR-AI-12 (UX), FR-FAM-10 (UX)
- **Depends on:** T-MOB-11 (entitlements), T-MOB-06
- **Milestone:** M8
- **Layer:** mobile
**Why** — Upgrade by bKash/Nagad without ever typing a PIN in our app.
**Files** — C `lib/features/billing/ui/plans_screen.dart` (route `/plans`), `ui/quota_card.dart` (reusable "এ মাসের এআই শেষ। হাতে লিখে বা অফলাইন কথায় চলবে।" card used by A3, D6, B5), `ui/invoices_screen.dart`, `data/billing_repository.dart` (`GET /plans`, `GET /families/:id/subscription`, `POST …/checkout {planCode, interval, provider}` → `{checkoutUrl, paymentId}`, `POST …/cancel`, `GET …/invoices`), fake, ARB `plan_*` from `Plans.dc.html`.
**Steps** — 1. Three plan cards (ফ্রি ৳০, প্লাস ৳৯৯ মাস / ৳৯৯৯ বছর, প্রবাসী ৳১৪৯ মাস) with included items as icon + word rows, "বর্তমান প্ল্যান" marker (icon + text). 2. Buttons "বিকাশ দিয়ে দিন", "নগদ দিয়ে দিন" (and "কার্ড") → `checkoutUrl` opens in the external browser via `url_launcher`; note under the buttons "আমরা আপনার বিকাশের পিন চাই না". 3. Return deep link `amarporibar://billing/return?paymentId=&status=` → poll `GET …/subscription` until `active` (max 60 s) then show "প্ল্যান চালু হয়েছে". 4. Quota card at top when `aiUsedMonth >= aiQuotaMonth` (from `CachedEntitlements`). 5. Only Owner can buy; others see "মালিককে জানান" with a buzz button.
**Contract** — plan `{code,name,priceMonthlyPaisa,priceYearlyPaisa,limits:{members,aiQuotaMonth,historyMonths},features:[…]}`; subscription `{planCode,status,currentPeriodEnd}`.
**Tests** — `plans_screen_test.dart`: cards and strings; checkout opens the URL via a fake launcher; return link polls until active (AC-39 client); non-owner message; quota card shown/hidden; golden `E7_plans.png`.
**Acceptance** — standard.
**Done when** — fake gateway flow upgrades the entitlements row.

### T-MOB-66 · E8 Dhar: money lent and borrowed *(screen, schema v10)*
- **Closes:** FR-LEND-01..04, AC-41 (client)
- **Depends on:** T-MOB-26, T-MOB-35
- **Milestone:** M8
- **Layer:** mobile
**Why** — Track informal loans in plain words.
**Files**
- M `tables.dart` — `class DharEntries extends Table { id, familyId, direction ('lent'|'borrowed'), personName, personPhone?, amountPaisa, date, dueDate?, note?, isPrivate, createdBy, settledAt?, updatedAt }`, `class DharRepayments extends Table { id, dharId, amountPaisa, date }`; `schemaVersion => 10`; `if (from < 10) { createTable(dharEntries); createTable(dharRepayments); }`; dump `drift_schema_v10.json`.
- C `lib/features/dhar/ui/dhar_screen.dart` (route `/dhar`), `ui/dhar_edit_sheet.dart`, `ui/repayment_sheet.dart`, `data/dhar_repository.dart` (online-first with Drift cache; REST `/dhar`, `/dhar/:id/repayments`), `domain/dhar_status.dart` (`open | partlyPaid | settled | overdue` derived), fake, ARB `dhar_*` from `Dhar.dc.html` (tabs "আমি পাব" / "আমি দেব").
**Steps** — 1. Row: person, amount remaining, due date words ("৫ দিন বাকি" / "৩ দিন দেরি"), status chip (icon + word, never colour alone). 2. "ফেরত পেয়েছি" settles with one tap (adds a repayment of the remaining amount). 3. Partial repayment sheet with keypad. 4. Private flag hides from others. 5. Reminders (due day and 3 days before) come from the server push; local fallback via the scheduler. 6. Dhar never changes spending reports.
**Contract** — `{id,direction,personName,personPhone,amountPaisa,date,dueDate,note,isPrivate,settledAt,repayments:[{id,amountPaisa,date}]}`.
**Tests** — `dhar_status_test.dart` (derivation table), `dhar_screen_test.dart`, `migration_v9_to_v10_test.dart`; golden `E8_dhar.png`.
**Acceptance** — standard.
**Done when** — AC-41 client logic holds.

---

## M6 · Video

### T-MOB-67 · Video messages (record, compress, upload, play)
- **Closes:** FR-VMSG-01, NFR-19
- **Depends on:** T-MOB-45, T-MOB-46, T-MOB-72
- **Milestone:** M6
- **Layer:** mobile
**Why** — A 30 s clip family members can watch later.
**Files**
- M `pubspec.yaml` add `camera ^0.11.0`, `video_compress ^3.1.3`.
- C `lib/features/chat/ui/video_message_screen.dart` (route `/talk/:conversationId/video`), `lib/core/video/video_recorder.dart` (`camera` plugin, `ResolutionPreset.low` (352×288) front camera default, max 30 s with a visible countdown), `lib/core/video/video_compressor.dart` (`video_compress` to `VideoQuality.LowQuality`, 360p, bitrate ≤ 600 kbps; verify ≤ 8 MB else reduce quality once more), thumbnail via `VideoCompress.getByteThumbnail`, M `media_uploader.dart` (kind `video` plus thumbnail upload), M `video_bubble.dart` playback (full-screen player with `video_player ^2.9.2`), ARB `chat_video_*` from the `Chat.dc.html` video bubble and the voice note screen wording.
**Steps** — 1. Entry from the composer long-press menu "ভিডিও পাঠান". 2. Record → review → send. 3. Checks: duration ≤ 30 000 ms, bytes ≤ 8 000 000 else message "ভিডিও অনেক বড় হয়ে গেছে". 4. Outbox kind `video` with `localMediaPath` and `thumbPath`. 5. Playback streams from the signed URL; download-on-demand only (no auto-download on mobile data).
**Contract** — `POST /v1/conversations/:id/video-messages {durationMs, bytes, mime, thumbBytes}` → presigned URLs (video + thumbnail) → confirm.
**Tests** — `video_message_test.dart`: limits enforced before upload; thumbnail uploaded; outbox ordering with voice notes; `video_compressor_test.dart` (uses an injected platform interface fake).
**Acceptance** — `cd apps/mobile && flutter test test/features/chat test/core/video`
**Done when** — a clip appears as a bubble matching the Chat board.

### T-MOB-68 · WebRTC call engine, ICE credentials, stats-based degradation
- **Closes:** FR-VIDEO-01, -03, -05 (engine), -06, FR-VIDEO-09 (permissions), NFR-18, AC-32, AC-34
- **Depends on:** T-MOB-36, T-MOB-72
- **Milestone:** M6
- **Layer:** mobile
**Why** — The media plumbing behind screen 5.
**Files**
- M `pubspec.yaml` add `flutter_webrtc ^0.12.5`.
- C `lib/core/rtc/call_engine.dart` — `abstract class CallEngine { Stream<CallEngineEvent> get events; Future<void> start({required bool video, required List<IceServer> servers}); Future<SessionDescription> createOffer(); Future<SessionDescription> createAnswer(SessionDescription offer); Future<void> setRemoteAnswer(SessionDescription); Future<void> addIceCandidate(IceCandidate); Future<void> setMicEnabled(bool); Future<void> setCameraEnabled(bool); Future<void> switchCamera(); Future<void> end(); Stream<CallQuality> get quality; RTCVideoRenderer get local; RTCVideoRenderer get remote; }`, `WebRtcCallEngine` (real), `FakeCallEngine` (loopback pair for tests).
- C `lib/core/rtc/ice_provider.dart` — `IceProvider` fetching `GET /v1/rtc/ice` → `{servers:[{urls, username, credential}], ttlSeconds}`, caches until 5 minutes before expiry; **fails closed**: no credentials → call fails with `IceUnavailable` (no public STUN fallback).
- C `lib/core/rtc/signaling.dart` — maps `CallSignalEvent`s to engine calls: `call.offer`, `call.answer`, `call.ice` (trickle ICE), `call.end`; sends through `RealtimeClient.send(ClientFrame.callSignal(...))`.
- C `lib/core/rtc/quality_monitor.dart` — every 2 s `getStats()`: computes `packetLossPercent`, `rttMs`, `outboundBitrate`; state machine: start `video360` (max 400 kbps video, 15 fps) → `video240` after loss > 8% for 5 s → `audioOnly` after loss > 15% for 5 s (disable video track, show "শুধু কথা চলছে") → recover one level up after loss < 3% for 15 s; emits `CallQuality {level: good|weak|none, mode}` where `good` = loss < 5%, `weak` = 5–15%, `none` = disconnected; ARB `call_quality_*`: "ভালো সংযোগ", "দুর্বল সংযোগ", "সংযোগ নেই", "শুধু কথা চলছে".
- C `lib/core/rtc/call_session.dart` — orchestrates `CallRepository` (`invite`, `accept`, `reject`, `end`, `busy`) + `CallEngine` + `Signaling`; supports up to 4 participants **by design** (map of `userId → CallEngine`), but P2 UI limits to 1:1.
- C `test/helpers/fake_call_engine.dart`.
**Steps** — 1. Implement engine with `RTCPeerConnection` config `{iceServers, sdpSemantics: 'unified-plan', iceTransportPolicy: 'all'}`; set video constraints 640×360@15 initially. 2. Caller flow: `call.invite` → on `call.accepted` create offer → `call.offer` → receive `call.answer` → trickle ICE both ways. 3. Callee flow: accept → wait offer → answer. 4. Handle ICE restarts once on `disconnected` for 8 s before ending. 5. Permissions via T-MOB-72; if camera denied start audio-only.
**Contract** — SRS §8.4 and §5.4 signal types.
**Tests** — `quality_monitor_test.dart` with scripted stats (AC-34: loss 20% for 5 s → audio-only; recovery after 15 s of < 3%), `call_session_test.dart` using two `FakeCallEngine`s joined by a loopback `FakeRealtimeServer` (AC-32 client: offer/answer/ICE exchanged, media tracks present), `ice_provider_test.dart` (cache, fail closed on error), `signaling_test.dart`; `integration_test/call_loopback_test.dart` (emulator job, two `RTCPeerConnection`s in one app over loopback with a local TURN-less host candidate).
**Acceptance** — `cd apps/mobile && flutter test test/core/rtc`
**Done when** — AC-32 (client) and AC-34 pass.

### T-MOB-69 · Screen 5 call UI and incoming call *(screen)*
- **Closes:** FR-VIDEO-01, -04, -05, -08, FR-NUDGE-03 (call reply)
- **Depends on:** T-MOB-68, T-MOB-43
- **Milestone:** M6
- **Layer:** mobile
**Why** — Large, calm call controls with words, not just icons.
**Files** — C `lib/features/call/ui/call_screen.dart` (route `/call/:callId`), `ui/incoming_call_screen.dart` (same route when `state == ringing && incoming`), `widgets/call_controls.dart`, `widgets/quality_badge.dart`, `widgets/participant_chip.dart`; ARB `call_*` from `VideoCall.dc.html`: "{name}", "{place} · {duration}" ("রিয়াদ · ০৫:২৩"), quality badge, "আপনি" self tile, participant chips "আম্মু যোগ দিয়েছেন", "দাদি আসছেন…", control labels "মাইক", "শেষ করুন", "ক্যামেরা", incoming: "{name} ভিডিও কল করছেন", "ধরুন", "কাটুন".
**Steps** — 1. Background `#14110D`; remote video fills a 358×430 radius 28 area (or avatar 120 dp with initial when video off); self tile 96×128 radius 18 with 3 dp white border bottom-right; badge top-right (green `#2E9E4F` bg, dark text) always with words; participants row chips; bottom controls: 72 dp mic and camera discs (`#3A3228`; off state shows a slash icon **and** the word "বন্ধ"), 88 dp red `#D93025` hang-up with label "শেষ করুন" 16 bold. 2. Incoming: full-screen with continuous vibration `[0, 800, 400, 800]` repeating until answered/declined/45 s timeout, avatar 128 dp, two 88 dp buttons ধরুন (green) / কাটুন (red); timeout → missed. 3. Busy: if the callee is in a call, show "ব্যস্ত আছেন" and a "কম্পন দিন" button for the caller. 4. During calls keep the screen on (`wakelock_plus ^1.2.8`) and use the audio route earpiece/speaker toggle (not shown in the board; add a 56 dp "স্পিকার" chip). 5. Ending writes a call card in chat via the server event.
**Contract** — call states `ringing | connecting | active | ended(outcome)`.
**Tests** — `call_screen_test.dart`: controls labelled in Bangla (mic "মাইক", camera "ক্যামেরা", end "শেষ করুন") and sizes 72/72/88; quality badge text for each level; mic off shows "বন্ধ"; incoming screen vibrates until accepted (recording engine) and times out at 45 s with `fake_async`; busy message; goldens `5_video_call.png`, `5_incoming_call.png`.
**Acceptance** — standard.
**Done when** — matches `VideoCall.dc.html`; AC-33 client side (ring timeout → missed) passes.

### T-MOB-70 · Calls from everywhere and chat call cards
- **Closes:** FR-VIDEO-01, -07, -08, FR-NUDGE-03 (ফোন করি)
- **Depends on:** T-MOB-69, T-MOB-39, T-MOB-47
- **Milestone:** M6
- **Layer:** mobile
**Why** — One tap from chat, member rows, the কথা tab, a buzz reply and Home.
**Files** — C `lib/features/call/data/call_repository.dart` (+ fake + API through realtime frames), `lib/features/call/ui/call_picker_sheet.dart` (choose a member), M `chat_screen.dart` (video button), `family_screen.dart` (video buttons), `home_screen.dart` (tile "ভিডিও"), `incoming_buzz_screen.dart` ("ফোন করি" starts a call), `event_card.dart` (call outcome cards).
**Steps** — 1. All entry points call `callRepository.start(userId)` then `context.push('/call/:id')`. 2. Call card text by outcome: completed "ভিডিও কল · ৫:২৩", missed "মিস্ড কল", declined "কল ধরেননি", busy "ব্যস্ত ছিলেন". 3. A missed call creates an inbox item with a "ফোন করুন" action. 4. Only one active call at a time (a second invite while in a call returns `busy` automatically).
**Contract** — frames `call.invite{callId,to[],kind}`, `call.accepted`, `call.rejected`, `call.cancel`, `call.end`.
**Tests** — `call_entry_points_test.dart` (each entry point starts exactly one call), `call_cards_test.dart`.
**Acceptance** — `cd apps/mobile && flutter test test/features/call test/features/chat`
**Done when** — every call entry in the design opens screen 5.

---

## Cross-cutting

### T-MOB-71 · APK size gate (≤ 35 MB per ABI)
- **Closes:** NFR-22
- **Depends on:** T-MOB-01
- **Milestone:** M2 (turn on early, keeps every later PR honest)
- **Layer:** mobile + CI
**Why** — WebRTC, Firebase and fonts add weight; low-end phones have little storage.
**Files** — C `apps/mobile/tool/check_apk_size.dart` (arguments: folder, max MB; reads `build/app/outputs/flutter-apk/*-release.apk`, prints a table, exits 1 above the limit), M `.github/workflows/ci.yml` (job `mobile-size`: `flutter build apk --release --split-per-abi --target-platform android-arm,android-arm64 && dart run tool/check_apk_size.dart build/app/outputs/flutter-apk 35`), M `android/app/build.gradle.kts` (`isMinifyEnabled = true`, `isShrinkResources = true`, ProGuard file `proguard-rules.pro` with keep rules for WebRTC, Firebase, Drift), C `android/app/proguard-rules.pro`, M `pubspec.yaml` (font subsetting: only weights 400/500/600/700 of one family; no unused assets).
**Steps** — 1. Add the gate with the current limit; if already above 35 MB, fix by enabling shrinking and removing unused assets before turning on the gate. 2. Release signing: `signingConfig` reads `android/key.properties` if present else uses the debug key **only for CI size builds** (documented in the gradle file with a comment; production signing config is read from environment variables `ANDROID_KEYSTORE_B64`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `ANDROID_STORE_PASSWORD` by the release workflow in T-PLAT-xx).
**Contract** — none.
**Tests** — `test/tool/check_apk_size_test.dart` (fixture folder with a 36 MB file fails, 30 MB passes).
**Acceptance** — `cd apps/mobile && flutter build apk --release --split-per-abi && dart run tool/check_apk_size.dart build/app/outputs/flutter-apk 35`
**Done when** — CI fails if any ABI APK exceeds 35 MB.

### T-MOB-72 · Permission flows and Android manifest completion
- **Closes:** FR-VIDEO-09, FR-VNOTE-01, FR-NOTIF-06, GAP-MOB-06
- **Depends on:** T-MOB-06
- **Milestone:** M3 (before voice notes) — also used by M6
- **Layer:** mobile
**Why** — Ask for each permission in Bangla, at the moment it is needed, and keep a working fallback when denied.
**Files** — M `android/app/src/main/AndroidManifest.xml` — add `CAMERA`, `POST_NOTIFICATIONS`, `VIBRATE`, `USE_FULL_SCREEN_INTENT`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`, `MODIFY_AUDIO_SETTINGS`, `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_PHONE_CALL`/`MICROPHONE` only if the call service needs it (decision: no foreground service in P2; calls end if the app is killed), keep existing; `<uses-feature android:name="android.hardware.camera" android:required="false"/>` and `microphone required=false`; `android:allowBackup="false"`; `android:usesCleartextTraffic="false"` for release (debug variant via `src/debug/AndroidManifest.xml` allows `10.0.2.2`), C `lib/core/permissions/permission_gate.dart` (`Future<PermissionResult> ensure(PermissionKind kind, BuildContext context)` showing `PermissionExplainer` (T-MOB-06) first, then the system dialog; kinds: `microphone`, `camera`, `notifications`, `nearby` (Bluetooth/Wi-Fi/location set per API level), `fullScreenIntent`), C `lib/core/permissions/permission_texts.dart` + ARB `perm_*` (e.g. microphone: "ভয়েস পাঠাতে মাইক লাগবে। আপনার কথা শুধু যাদের পাঠাবেন তারা শুনবে।"; camera: "ভিডিওর জন্য ক্যামেরা লাগবে।"; notifications: "কম্পন ও বাজেটের খবর পেতে অনুমতি দিন।"), M all screens that used `permission_handler` directly.
**Steps** — 1. Explainer sheet: icon, one Bangla sentence, big "অনুমতি দিন" and quiet "এখন নয়". 2. Denied once: show the explainer again next time; permanently denied: "সেটিংসে গিয়ে অনুমতি দিন" with `openAppSettings()`. 3. Fallbacks: camera denied → audio-only call; microphone denied → text-only; notifications denied → in-app inbox and foreground polling only (FR-NOTIF-08).
**Contract** — none.
**Tests** — `permission_gate_test.dart` with a fake `PermissionHandlerPlatform`: explainer shown before the system prompt; permanent denial offers settings; `manifest_test.dart` reads the XML and asserts the required permissions and `allowBackup=false` are present.
**Acceptance** — `cd apps/mobile && flutter test test/core/permissions`
**Done when** — no code calls `Permission.x.request()` outside `PermissionGate`.

### T-MOB-73 · Empty, error and offline states everywhere
- **Closes:** FR-ONB-02, FR-ONB-03, FR-A11Y-02
- **Depends on:** T-MOB-06, T-MOB-48
- **Milestone:** M4
- **Layer:** mobile
**Why** — Every list and failure needs one plain sentence and one next step.
**Files** — C `lib/ui/error_view.dart` (`ErrorView(kind: offline|server|forbidden|notFound|quota|unknown, onRetry)`), C `lib/app/offline_banner.dart` (global `BannerStrip` shown by `AppShell` when `syncState == offline`), C `lib/core/errors/error_mapper.dart` (`ApiException`/`SocketException` → `AppFailure` → localised message key; codes covered: `ai_quota`, `ai_unavailable`, `plan_member_limit`, `plan_required`, `family_suspended`, `forbidden`, `not_found`, `otp_*`, `duplicate_trx_id`, `clock_drift`, `nudge_rate_limited`), M ARB `err_*` (every failure with Bangla sentence + next step), M all screens to use `EmptyState`/`ErrorView`.
**Steps** — 1. Implement the mapper with a total function (default "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।"). 2. `family_suspended`: banner "এই পরিবারের হিসাব এখন শুধু দেখা যাবে।" and all write buttons disabled (with the reason in the semantics hint). 3. `clock_drift`: dialog telling the user to fix the phone's date and time with a settings button (`AppSettings.openDateSettings` via platform channel `ap/system`). 4. Every `EmptyState` speaks its hint in Simple mode.
**Contract** — see SRS §5.2 error codes.
**Tests** — `error_mapper_test.dart` (every code → key exists in both ARB files), `empty_states_test.dart` (each list screen renders `EmptyState` with action), `offline_banner_test.dart`.
**Acceptance** — `cd apps/mobile && flutter test test/core/errors test/ui`
**Done when** — `rg "catch \\(_\\) \\{\\}" lib` returns nothing outside storage fallbacks.

### T-MOB-74 · Deep-link and notification-tap integration tests
- **Closes:** FR-FAM-02, FR-NUDGE-03, FR-VIDEO-04, FR-BUD-02
- **Depends on:** T-MOB-08, T-MOB-34, T-MOB-43, T-MOB-69
- **Milestone:** M3
- **Layer:** mobile
**Why** — Links and taps are where mobile apps usually break.
**Files** — C `integration_test/deep_links_test.dart`, C `integration_test/helpers/launch.dart`.
**Steps** — Cases: `amarporibar://join/abc` cold start signed out → login → join; `https://amarporibar.app/join/abc` same; buzz notification tap → `/buzz/incoming/<id>`; chat message push → `/talk/<id>`; call push → `/call/<id>` ringing; budget push → `/budget`; stale/unknown id → `ErrorScreen`.
**Contract** — none.
**Tests** — the file above (run on the emulator job).
**Acceptance** — `cd apps/mobile && flutter test integration_test/deep_links_test.dart -d emulator-5554` (CI emulator job)
**Done when** — all seven cases pass.

### T-MOB-75 · Mobile verification scripts and emulator CI job
- **Closes:** NFR-11, NFR-20, SRS §13.1 (`verify:mN`)
- **Depends on:** T-MOB-01, T-MOB-52, T-MOB-71
- **Milestone:** M0 → grows each milestone
- **Layer:** mobile + CI
**Why** — `pnpm verify:mN` (T-PLAT) must be able to run the mobile checks for a milestone with one command.
**Files** — C `apps/mobile/tool/verify.sh` (usage `tool/verify.sh M2`: runs, in order, `flutter pub get`, `build_runner`, `dart format --set-exit-if-changed`, `flutter analyze --fatal-infos`, `dart run tool/l10n_check.dart`, `dart run tool/sync_fixtures.dart`, `flutter test --coverage` (includes goldens, a11y, contract), `check_coverage 70`, and for M ≥ 3 `flutter test integration_test -d emulator`; M ≥ 2 adds the APK size gate), M root `package.json` scripts `mobile:verify:m0..m8` delegating to the script, M `.github/workflows/ci.yml` — job `mobile-emulator` using `reactivecircus/android-emulator-runner@v2` (API 34, `x86_64`, `google_apis`) running `flutter test integration_test`.
**Steps** — 1. Write the script with a milestone table. 2. Add the emulator job (only on pushes to main and pull requests labelled by path filter `apps/mobile/**`). 3. Add a `--help` output.
**Contract** — exit code 0 only when every step passes.
**Tests** — `test/tool/verify_script_test.dart` (parses the script and asserts every milestone name M0..M8 is defined).
**Acceptance** — `cd apps/mobile && tool/verify.sh M0`
**Done when** — the root `verify:mN` scripts call it.

### T-MOB-76 · Acceptance-criteria tag map (MOB layer)
- **Closes:** SRS §15 (AC-01, -06, -08, -09, -11, -12, -13, -16, -17, -18, -23, -24, -25, -26, -32, -34, -37, -41 client parts)
- **Depends on:** the screen tasks that own each AC
- **Milestone:** M2 → M8
- **Layer:** mobile + docs
**Why** — SRS §15 acceptance criteria must be provably covered by named tests.
**Files** — C `docs/tasks/ac-mobile.json` — `[{ "ac":"AC-08", "tests":["quick_parser_test: AC-08", "voice_entry_screen_test: AC-08"] }, …]`; C `apps/mobile/tool/check_ac_tags.dart` — scans `test/**` and `integration_test/**` for `test('AC-08 …'` / `testWidgets('AC-08 …'` names (convention: the test name **starts with the AC id**), fails when a listed AC has no matching test or a test cites an AC not in the JSON; M each screen task's tests (already named in this file) prefix names with the AC id; M `tool/verify.sh` runs the checker.
**Steps** — 1. Create the map for the MOB-layer ACs: AC-01 (T-MOB-23/24), AC-06 (T-MOB-04 key-diff + every screen's bn/en pump), AC-08/09 (T-MOB-28), AC-10 (T-MOB-31), AC-11 (T-MOB-50), AC-12 (T-MOB-14/15), AC-13 (T-MOB-07/16), AC-16 (T-MOB-41/42 quiet hours), AC-17 (T-MOB-42), AC-18 (T-MOB-40), AC-23 (T-MOB-48), AC-24 (shared HLC vectors, existing `hlc_test.dart`/`peer_sync_test.dart`), AC-25 (T-MOB-49), AC-26 (goldens D1, D2, D3, F4), AC-32/34 (T-MOB-68), AC-37 (T-MOB-63), AC-41 (T-MOB-66). 2. Rename the matching tests. 3. Add the checker.
**Contract** — test name convention above.
**Tests** — `test/tool/check_ac_tags_test.dart` (fixture folders).
**Acceptance** — `cd apps/mobile && dart run tool/check_ac_tags.dart ../../docs/tasks/ac-mobile.json`
**Done when** — every mobile-layer acceptance criterion maps to at least one test.

---

## Appendix · screen → task and golden index

| Code | Task | Golden file(s) |
|---|---|---|
| Main | T-MOB-23 | `Main_home.png`, `Main_home_dark.png` |
| 2 | T-MOB-41 | `2_buzz.png` |
| 3 / Chat | T-MOB-39, -40 | `Chat_thread.png`, `Chat_thread_dark.png` |
| 4 | T-MOB-45 | `4_voice_note.png` |
| 5 | T-MOB-69 | `5_video_call.png`, `5_incoming_call.png` |
| 6 | T-MOB-43 | `6_incoming_buzz.png` |
| A1 | T-MOB-14 | `A1_login.png`, `A1_login_code.png` |
| A2 | T-MOB-17 | `A2_consent.png` |
| A3 | T-MOB-28 | `A3_voice_entry.png` |
| A4 | T-MOB-29 | `A4_category_picker.png` |
| A5 | T-MOB-30 | `A5_sms.png` |
| A6 | T-MOB-18 | `A6_join.png` |
| A7 | T-MOB-15 | `A7_otp_error.png` |
| B1 | T-MOB-25 | `B1_transactions.png`, `B1_transactions_dark.png` |
| B2 | T-MOB-31 | `B2_summary.png` |
| B3 | T-MOB-32 | `B3_budgets.png`, `B3_budgets_dark.png` |
| B4 | T-MOB-47 | `B4_family.png`, `B4_family_dark.png` |
| B5 | T-MOB-62 | `B5_ask.png` |
| B6 | T-MOB-33 | `B6_settings.png` |
| D1 | T-MOB-19 | `D1_welcome.png`, `D1_welcome_simple.png` |
| D2 | T-MOB-21 | `D2_tutorial.png` |
| D3 | T-MOB-50 | `D3_simple_home.png` |
| D4 | T-MOB-26 | `D4_add_expense.png` |
| D5 | T-MOB-27 | `D5_transaction_detail.png` |
| D6 | T-MOB-60 | `D6_receipt.png` |
| D7 | T-MOB-61 | `D7_rule_learn.png` |
| D8 | T-MOB-22 | `D8_voice_fallback.png` |
| E1 | T-MOB-54 | `E1_accounts.png` |
| E2 | T-MOB-55 | `E2_categories.png` |
| E3 | T-MOB-56 | `E3_recurring.png` |
| E4 | T-MOB-57 | `E4_festival.png` |
| E5 | T-MOB-58 | `E5_reports.png` |
| E6 | T-MOB-59 | `E6_remit.png` |
| E7 | T-MOB-65 | `E7_plans.png` |
| E8 | T-MOB-66 | `E8_dhar.png` |
| F1 | T-MOB-38 | `F1_chat_list.png`, `F1_chat_list_dark.png` |
| F2 | T-MOB-53 | `F2_family_switch.png` |
| F3 | T-MOB-35 | `F3_notifications.png` |
| F4 | T-MOB-49 | `F4_sync_status.png` |
| F5 | T-MOB-63 | `F5_bazaar.png` |
| F6 | T-MOB-16 | `F6_session_expired.png` |
| F7 | T-MOB-64 | `F7_delete_account.png` |
| F8 | T-MOB-20 | `F8_profile.png` |

Admin screens (C0–C4, G1–G4) are implemented in `apps/admin` (see `05-web-admin.md`), not in the mobile app.

## Appendix · Drift schema version plan

| Version | Task | Change |
|---|---|---|
| 3 | existing | `Transactions`, `CachedCategories`, `CachedAccounts`, `Meta`, `PendingEntries` |
| 4 | T-MOB-11 | `CachedBudgets`, `CachedMembers`, `CachedEntitlements`, account balance columns |
| 5 | T-MOB-24 | transaction `familyId`, `splitGroupId`, `attachmentKey`, `paidByUserId`, `createdBy`, index |
| 6 | T-MOB-35 | `InboxItems` |
| 7 | T-MOB-37 | `Conversations`, `Messages`, `OutboxMessages`, `MediaCache` |
| 8 | T-MOB-41 | `NudgeLog`, `NudgePhrases` |
| 9 | T-MOB-63 | `ShoppingLists`, `ShoppingItems` |
| 10 | T-MOB-66 | `DharEntries`, `DharRepayments` |

Rule: whichever task merges first takes the next free number; a later task rebases and renumbers its migration (the migration tests and `drift_schemas/*.json` are the guard). Each bump adds `migration_vN_to_vM_test.dart` that opens the previous schema dump, inserts rows, upgrades, and asserts old rows and new tables.
