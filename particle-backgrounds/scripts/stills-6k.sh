#!/usr/bin/env bash
# 2 stills per composition at 6000x3375 (scale 1.5625 of 3840x2160), frames 120 and 450 (450-120 is not a multiple of the 75-frame pulse).
set -euo pipefail
OUT=${OUT:-out/stills-6k}
mkdir -p "$OUT"
scripts/compositions.sh | while read -r ID NAME; do
  for F in 120 450; do
    npx remotion still "$ID" "$OUT/${NAME}_f$F.png" --frame=$F --scale=1.5625 --image-format=png --log=error
  done
done
