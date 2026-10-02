#!/usr/bin/env bash
# Usage: scripts/stills.sh <CompositionId> <scale> <outdir> <frame> [frame...]
# Bundles once, then renders each frame as a PNG still.
set -euo pipefail
COMP=$1; SCALE=$2; OUT=$3; shift 3
GL=${GL:-angle}
BUNDLE=${BUNDLE:-$(mktemp -d)/bundle}
if [ ! -f "$BUNDLE/index.html" ]; then npx remotion bundle --out-dir="$BUNDLE" >/dev/null; fi
mkdir -p "$OUT"
for F in "$@"; do
  npx remotion still "$BUNDLE" "$COMP" "$OUT/${COMP}_f${F}.png" --frame="$F" --scale="$SCALE" --gl="$GL" 2>&1 | grep -iE "error|^\+|○" || true
done
