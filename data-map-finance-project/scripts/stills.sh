#!/usr/bin/env bash
# Two 6000x3375 PNG stills per composition (scale 6000/3840 = 1.5625).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/stills
grep -v '^#' scripts/compositions.txt | while read -r ID FILE _ A B; do
  [ -z "$ID" ] && continue
  for F in $A $B; do
    npx remotion still "$ID" "out/stills/${FILE}_f${F}_6000.png" --frame="$F" --scale=1.5625 --gl=angle
  done
done
