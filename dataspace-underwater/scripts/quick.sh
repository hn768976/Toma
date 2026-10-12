#!/usr/bin/env bash
# usage: scripts/quick.sh <compId> <frames csv> [scale]  → out/s/<comp>_fNNNN.png + out/sheet_<comp>.png
set -e
cd "$(dirname "$0")/.."
rm -rf out/bundle && npx remotion bundle --out-dir=out/bundle >/dev/null 2>&1
rm -rf out/s/$1 && node scripts/stills.mjs "$1" out/s/$1 "${3:-0.3333333333333333}" "$2" out/bundle 2>&1 | grep -E "^frame|Error|error" || true
scripts/sheet.sh out/s/$1 out/sheet_$1.png
