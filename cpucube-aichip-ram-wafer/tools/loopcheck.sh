#!/bin/bash
# Loop check: 601-frame compositions, unwrapped time; frame 600 must equal frame 0.
cd "$(dirname "$0")/.."
OUT=out/loop
for c in "$@"; do
  node tools/stills.mjs $c $OUT 0.3333333333333333 0,600 --loopcheck 2>&1 | grep -E "rror" 
  echo -n "$c: "; python3 tools/compare.py $OUT/${c}_0000.png $OUT/${c}_0600.png
done
