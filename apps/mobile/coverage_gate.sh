#!/usr/bin/env bash
# Coverage gate (NFR-11): >= 70% line coverage over lib/domain, lib/data and lib/core.
# Usage: bash coverage_gate.sh [lcov.info] [min%]   (run after `flutter test --coverage`)
set -euo pipefail
cd "$(dirname "$0")"
LCOV="${1:-coverage/lcov.info}"
MIN="${2:-70}"
[ -f "$LCOV" ] || { echo "missing $LCOV (run flutter test --coverage first)" >&2; exit 2; }
awk -v min="$MIN" '
  /^SF:/ {
    p = substr($0, 4); gsub(/\\/, "/", p)
    inc = (p ~ /^lib\/(domain|data|core)\//) && p !~ /\.g\.dart$/ && p !~ /\.freezed\.dart$/
  }
  inc && /^LF:/ { found += substr($0, 4) }
  inc && /^LH:/ { hit += substr($0, 4) }
  END {
    pct = found ? hit * 100 / found : 0
    printf "coverage %.1f%% (%d/%d lines) in lib/domain, lib/data, lib/core\n", pct, hit, found
    if (pct < min) { printf "below the %s%% threshold\n", min > "/dev/stderr"; exit 1 }
  }' "$LCOV"
