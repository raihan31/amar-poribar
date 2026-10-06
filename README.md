# আমার পরিবার · Amar Poribar

A family expense tracker for Bangladesh with AI-assisted entry. Family members log spending in Bangla, Banglish or English, or by pasting a bKash/Nagad/Rocket SMS. Everyone sees one shared monthly picture.

- **Business requirements:** [docs/BRD.md](docs/BRD.md) (includes the Bangladesh market analysis)
- **Software requirements:** [docs/SRS.md](docs/SRS.md)

## Monorepo layout

```
apps/
  api/       Fastify REST API, Drizzle ORM, PostgreSQL
  web/       Next.js web app
  mobile/    Expo (React Native) Android/iOS app
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
pnpm dev                      # api :4000, web :3000, Expo dev server
```

Without `ANTHROPIC_API_KEY`, MFS SMS parsing still works. Free-text notes return no drafts, and the user enters them manually.

In development, the OTP endpoint returns the code in its response (`devCode`), so no SMS gateway is needed.

## Common commands

| Command | What it does |
|---|---|
| `pnpm test` | Unit tests (vitest) for all packages |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm build` | Build packages, API and web |
| `pnpm --filter @amar-poribar/mobile android` | Run the mobile app on an Android emulator |

## Status

The MVP skeleton (Phase 1 in the BRD) is in place: OTP login, family workspace with default BD categories and accounts, transactions with duplicate TrxID protection, AI/SMS parse → confirm flow, and a monthly summary on web and mobile.

Main open items for Phase 1: an SMS gateway for OTP, stored and rotatable refresh tokens, invitations and role management UI, budgets and alerts, CSV export, persisting the mobile token in secure storage, and DB-backed integration tests.
