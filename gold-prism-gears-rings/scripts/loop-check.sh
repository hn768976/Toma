#!/usr/bin/env bash
# Loop check: make the composition 601 frames long (loopCheck prop), render
# frames 0 and 600 as PNG and compare pixel for pixel.
#   scripts/loop-check.sh <CompositionId> [bundleDir]
set -euo pipefail
ID=$1; BUNDLE=${2:-out/bundle}
mkdir -p out/check
for f in 0 600; do
  npx remotion still "$BUNDLE" "$ID" "out/check/${ID}_loop_$f.png" --frame=$f \
    --scale=0.3333333333333333 --gl=angle --props='{"loopCheck":true}' --log=error
done
python3 scripts/compare.py "out/check/${ID}_loop_0.png" "out/check/${ID}_loop_600.png" "LOOP $ID"
