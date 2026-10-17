#!/bin/bash
# Step 2: with loops made 601 frames long, frame 600 must equal frame 0.
set -e
mkdir -p out/verify/loop
for id in CloudSea-Loop RainbowRings-Spectrum SunLeaves-Summer SunLeaves-Autumn DataGrid-Teal RippleRings-Blue; do
  for f in 0 600; do
    npx remotion still build $id out/verify/loop/${id}_$f.png --frame=$f --scale=0.3333333333333333 \
      --props='{"loopCheck":true}' >/dev/null 2>&1
  done
  python3 scripts/verify/compare.py out/verify/loop/${id}_0.png out/verify/loop/${id}_600.png "$id loop 0 vs 600"
done
