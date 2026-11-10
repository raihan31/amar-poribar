#!/usr/bin/env bash
# Mobile verification for one milestone. Exit 0 only when every step passes.
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: tool/verify.sh <M0..M8>

Runs, in order: flutter pub get, build_runner, dart format check,
flutter analyze --fatal-infos, l10n_check, sync_fixtures,
flutter test --coverage (goldens, a11y, contract), coverage gate (70%),
for M3 and later `flutter test integration_test -d emulator`,
for M2 and later the APK size gate.

Options:
  -h, --help   Show this help.
USAGE
}

# Milestone table: name, run integration tests (1/0), run APK size gate (1/0).
table() {
  cat <<'TABLE'
M0 0 0
M1 0 0
M2 0 1
M3 1 1
M4 1 1
M5 1 1
M6 1 1
M7 1 1
M8 1 1
TABLE
}

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
  "") usage >&2; exit 2 ;;
esac

row=$(table | awk -v m="$1" '$1 == m { print }')
if [ -z "$row" ]; then
  echo "unknown milestone: $1 (expected M0..M8)" >&2
  exit 2
fi
read -r _ with_integration with_size <<<"$row"

cd "$(dirname "$0")/.."

step() {
  echo "==> $*"
  "$@"
}

step flutter pub get
step dart run build_runner build --delete-conflicting-outputs
step flutter gen-l10n
step dart format --output=none --set-exit-if-changed lib test
step flutter analyze --fatal-infos
step dart run tool/l10n_check.dart
step dart run tool/sync_fixtures.dart
step flutter test --coverage
step dart run tool/check_coverage.dart 70 lib/domain lib/data lib/core coverage/lcov.info

if [ "$with_integration" = 1 ]; then
  step flutter test integration_test -d emulator
fi

if [ "$with_size" = 1 ]; then
  step flutter build apk --release --split-per-abi --target-platform android-arm,android-arm64
  step dart run tool/check_apk_size.dart build/app/outputs/flutter-apk 35
fi

echo "mobile verify $1: OK"
