#!/usr/bin/env bash
# Fresh bundle, then 720p stills: scripts/stills.sh <CompId> <outPrefix> <frame> [frame ...]
set -euo pipefail
cd "$(dirname "$0")/.."
id=$1; prefix=$2; shift 2
rm -rf out/bundle-stills
npx remotion bundle --out-dir=out/bundle-stills >/dev/null 2>&1
for f in "$@"; do
  npx remotion still out/bundle-stills "$id" "${prefix}_$f.png" --frame="$f" --scale=0.3333333333333333 >/dev/null 2>&1
done
