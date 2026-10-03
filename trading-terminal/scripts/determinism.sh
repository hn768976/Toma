#!/usr/bin/env bash
# Step 2: frame 300 rendered alone from a cold start must equal frame 300 of a
# full multi-threaded render, byte for byte.
#   scripts/determinism.sh <CompositionId> [scale]
set -euo pipefail
cd "$(dirname "$0")/.."
ID="$1"
SCALE="${2:-0.3333333333333333}"
D="out/determinism/$ID"
rm -rf "$D" && mkdir -p "$D/seq"
# Full render of all 450 frames as PNGs, 4 threads (frames render out of order).
npx remotion render "$ID" "$D/seq" --sequence --image-format=png --scale="$SCALE" --concurrency=4 >/dev/null 2>&1
# Cold start: a fresh browser renders only frame 300.
npx remotion still "$ID" "$D/still-300.png" --frame=300 --image-format=png --scale="$SCALE" >/dev/null 2>&1
SEQ=$(ls "$D"/seq/*300.png)
A=$(sha256sum "$SEQ" | cut -d' ' -f1)
B=$(sha256sum "$D/still-300.png" | cut -d' ' -f1)
echo "$ID full-render frame 300: $A"
echo "$ID cold still frame 300:  $B"
if [ "$A" = "$B" ]; then echo "$ID: IDENTICAL"; else echo "$ID: DIFFERENT"; exit 1; fi
