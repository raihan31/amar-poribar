#!/usr/bin/env bash
# Verification used by the milestone workflow. Usage: tools/orchestrate/verify.sh [--quick|--full]
# --quick: typecheck + arch + unit tests. --full: everything incl. lint, format, DB tests, mobile.
set -uo pipefail
MODE="${1:---full}"
cd "$(git rev-parse --show-toplevel)"
fail=0
run() { echo "\$ $*"; if ! "$@"; then echo "FAILED: $*"; fail=1; fi; }
has_script() { node -e "const s=require('./package.json').scripts||{};process.exit(s['$1']&&!/^echo /.test(s['$1'])?0:1)"; }

pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install >/dev/null 2>&1 || { echo "FAILED: pnpm install"; exit 1; }
run pnpm typecheck
run pnpm test
has_script arch && run pnpm arch
if [ "$MODE" = "--full" ]; then
  run pnpm lint
  run pnpm format:check
  has_script openapi:check && run pnpm openapi:check
  if has_script test:db; then
    PG="verify-pg-$$"
    docker run -d --rm --name "$PG" -e POSTGRES_USER=amar -e POSTGRES_PASSWORD=amar -e POSTGRES_DB=amar_poribar -p 127.0.0.1::5432 postgres:16-alpine >/dev/null
    for i in $(seq 1 30); do docker exec "$PG" pg_isready -U amar >/dev/null 2>&1 && break; sleep 1; done
    PORT=$(docker port "$PG" 5432/tcp | head -1 | sed 's/.*://')
    DATABASE_URL="postgres://amar:amar@127.0.0.1:$PORT/amar_poribar" run pnpm test:db
    docker stop "$PG" >/dev/null 2>&1
  fi
  if [ -d apps/mobile ] && git diff --name-only "${VERIFY_BASE:-HEAD~1}" HEAD -- apps/mobile 2>/dev/null | grep -q .; then
    (cd apps/mobile && run flutter pub get && run dart run build_runner build --delete-conflicting-outputs && run flutter analyze && run flutter test)
  fi
fi
[ "$fail" = 0 ] && echo "VERIFY OK ($MODE)" || echo "VERIFY FAILED ($MODE)"
exit $fail
