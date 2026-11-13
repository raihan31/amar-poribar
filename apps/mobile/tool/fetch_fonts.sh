#!/usr/bin/env bash
# Downloads Hind Siliguri static TTFs (SIL OFL 1.1) from the google/fonts repo.
# The files are committed, so CI never needs to run this.
set -euo pipefail
dir="$(cd "$(dirname "$0")/.." && pwd)/assets/fonts"
mkdir -p "$dir"
base="https://raw.githubusercontent.com/google/fonts/main/ofl/hindsiliguri"
for w in Regular Medium SemiBold Bold; do
  curl -fsSL "$base/HindSiliguri-$w.ttf" -o "$dir/HindSiliguri-$w.ttf"
done
curl -fsSL "$base/OFL.txt" -o "$dir/OFL.txt"
