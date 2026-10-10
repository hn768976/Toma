#!/usr/bin/env bash
# Loop check: makes loops 601 frames long (REMOTION_LOOP_CHECK=1), renders
# frames 0 and 600 and compares them pixel for pixel.
set -e
OUT=${OUT:-out/checks}; mkdir -p "$OUT"
SCALE=${SCALE:-0.3333333333333333}
for id in "$@"; do
  REMOTION_LOOP_CHECK=1 npx remotion still "$id" "$OUT/${id}_f0.png" --frame=0 --scale=$SCALE --timeout=600000 --log=error
  REMOTION_LOOP_CHECK=1 npx remotion still "$id" "$OUT/${id}_f600.png" --frame=600 --scale=$SCALE --timeout=600000 --log=error
  echo -n "$id loop 0 vs 600: "; python3 scripts/compare.py "$OUT/${id}_f0.png" "$OUT/${id}_f600.png" || true
done
