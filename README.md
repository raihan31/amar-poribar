# আমার পরিবার · Amar Poribar

A family expense tracker for Bangladesh with AI-assisted entry. Family members log spending by **speaking** or typing in Bangla, Banglish or English, or by pasting a bKash/Nagad/Rocket SMS. The app reads each entry back aloud, explains the month in plain words, and can **speak the monthly summary**, so family members who read little can use it too. Everyone sees one shared monthly picture.

- **Business requirements:** [docs/BRD.md](docs/BRD.md) (includes the Bangladesh market analysis)
- **Software requirements:** [docs/SRS.md](docs/SRS.md)

## Monorepo layout

```
apps/
  api/       Fastify REST API, Drizzle ORM, PostgreSQL
  web/       Next.js web app
  mobile/    Flutter Android/iOS app (offline-first, Drift + CRDT sync)
packages/
  shared/    Zod schemas, types, BD categories, ৳ formatting, Bangla digits, i18n
  ai/        MFS SMS parser (offline, no AI cost) + Claude-based free-text parser
  tsconfig/  Shared TypeScript config
docs/        BRD, SRS
```

Tooling: pnpm workspaces + Turborepo, TypeScript throughout.

## Getting started

Requirements: Node 22+, pnpm 10, Docker (for PostgreSQL).

```bash
pnpm install
cp .env.example .env          # add ANTHROPIC_API_KEY to enable AI parsing of free text
pnpm db:up                    # start PostgreSQL in Docker
pnpm db:push                  # create tables
pnpm build                    # build shared packages
pnpm dev                      # api :4000, web :3000
```

Without `ANTHROPIC_API_KEY`, these still work: MFS SMS parsing, the offline quick parser for simple phrases ("আজ বাজারে আটশো পঞ্চাশ টাকা", "rickshaw 40"), and a template monthly summary. Complex sentences need the AI.

**Voice:** speech recognition and text-to-speech run on the device. On the web, use Chrome or Edge. Android phones need Google's Bangla text-to-speech voice for spoken output.

In development, the OTP endpoint returns the code in its response (`devCode`), so no SMS gateway is needed.

## Common commands

| Command | What it does |
|---|---|
| `pnpm test` | Unit tests (vitest) for all packages |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm build` | Build packages, API and web |
| `cd apps/mobile && flutter run` | Run the Flutter mobile app (first run `flutter pub get` and `dart run build_runner build`) |

## Status

The MVP skeleton (Phase 1 in the BRD) is in place: OTP login, family workspace with default BD categories and accounts, transactions with duplicate TrxID protection, AI/SMS parse → confirm flow, a monthly summary on web and mobile, plus voice entry with spoken read-back, an icon category picker, and a plain-language monthly summary with a Listen button.

Main open items for Phase 1: an SMS gateway for OTP, stored and rotatable refresh tokens, invitations and role management UI, budgets and alerts, CSV export, persisting the mobile token in secure storage, and DB-backed integration tests.
