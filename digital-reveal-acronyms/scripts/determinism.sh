#!/usr/bin/env bash
# Frame 180 rendered on its own from a cold start must match frame 180 of a
# full, multi-threaded (out-of-order) PNG-sequence render, byte for byte.
# Usage: bash scripts/determinism.sh [Composition] [scale]
set -euo pipefail
COMP=${1:-Reveal-CRM}
SCALE=${2:-0.5}
OUT=out/determinism/$COMP
rm -rf "$OUT" && mkdir -p "$OUT"
npx remotion render "$COMP" "$OUT/seq" --sequence --image-format=png --scale="$SCALE" --concurrency=4 >/dev/null
npx remotion still "$COMP" "$OUT/cold_180.png" --frame=180 --image-format=png --scale="$SCALE" >/dev/null
SEQ=$(ls "$OUT"/seq/*180.png)
sha256sum "$OUT/cold_180.png" "$SEQ"
if cmp -s "$OUT/cold_180.png" "$SEQ"; then echo "RESULT: PASS (byte-identical)"; else echo "RESULT: FAIL"; exit 1; fi
