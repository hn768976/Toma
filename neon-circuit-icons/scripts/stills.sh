#!/usr/bin/env bash
# Usage: scripts/stills.sh <outdir> <scale> "<frame list>" <comp> [comp...]
# Bundles once, then renders stills from the bundle.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=$1; SCALE=$2; FRAMES=$3; shift 3
BUNDLE=${BUNDLE:-out/bundle}
if [ -z "${REUSE_BUNDLE:-}" ] || [ ! -d "$BUNDLE" ]; then
  npx remotion bundle src/index.ts --out-dir="$BUNDLE" --log=error >/dev/null
fi
mkdir -p "$OUT"
for c in "$@"; do
  for f in $FRAMES; do
    npx remotion still "$BUNDLE" "$c" "$OUT/${c}_f${f}.png" --frame="$f" --scale="$SCALE" --log=error >/dev/null
    echo "$OUT/${c}_f${f}.png"
  done
done
