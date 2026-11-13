#!/usr/bin/env bash
# Regenerates (or checks) the admin visual baselines inside the pinned Playwright image, so fonts and
# rendering match CI. Usage: apps/admin/scripts/snapshots-docker.sh [update|check]   (default: update)
# The repository is mounted read-only and copied inside the container, so host node_modules are untouched;
# only e2e/__screenshots__ is written back.
set -euo pipefail

MODE="${1:-update}"
IMAGE="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.65.0-noble}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
OUT="$ROOT/apps/admin/e2e/__screenshots__"
mkdir -p "$OUT"

FLAGS=""
if [ "$MODE" = "update" ]; then FLAGS="--update-snapshots"; fi

docker run --rm --ipc=host \
  -v "$ROOT":/src:ro \
  -v "$OUT":/out \
  -e MODE="$MODE" -e FLAGS="$FLAGS" -e CI=1 \
  "$IMAGE" bash -euo pipefail -c '
    mkdir /work
    tar -C /src --exclude=node_modules --exclude=.next --exclude=.git --exclude=apps/mobile -cf - . | tar -C /work -xf -
    cd /work
    npm install -g pnpm@10.28.0 >/dev/null
    pnpm install --frozen-lockfile
    pnpm --filter @amar-poribar/fixtures build
    pnpm --filter @amar-poribar/admin build
    cd apps/admin
    mkdir -p e2e/__screenshots__
    if [ "$MODE" = "check" ]; then cp -R /out/. e2e/__screenshots__/; fi
    MOCK=1 pnpm exec playwright test -c e2e/playwright.config.ts e2e/visual $FLAGS --grep "visual screens"
    if [ "$MODE" = "update" ]; then cp -R e2e/__screenshots__/. /out/; fi
  '
