#!/usr/bin/env bash
# Regenerates golden images inside the pinned CI image so fonts and rasterisation match CI.
# Usage: tool/update_goldens.sh [test/goldens/<file>_test.dart]
set -euo pipefail
cd "$(dirname "$0")/.."
version="$(sed -n 's/.*"flutter": *"\([^"]*\)".*/\1/p' .fvmrc)"
target="${1:-test/goldens}"
docker run --rm -v "$PWD:/app" -w /app "ghcr.io/cirruslabs/flutter:${version}" bash -c \
  "flutter pub get && dart run build_runner build --delete-conflicting-outputs && flutter gen-l10n && flutter test --update-goldens ${target}"
