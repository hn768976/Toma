#!/usr/bin/env bash
# Step 2: temporarily make each looping composition 601 frames long (input prop
# durationOverride) and check frame 0 and frame 600 are identical pixel for pixel.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/loop
for id in ${*:-GlitterSmoke-Blue GlitterSmoke-VioletGold NeonPolygonFrame GlassTwist-IceBlue GlassTwist-Blush}; do
  for f in 0 600; do
    npx remotion still "$id" "out/loop/${id}_$f.png" --frame=$f --scale=0.3333333333333333 --image-format=png \
      --props='{"durationOverride":601}' --log=error >/dev/null 2>&1
  done
  if cmp -s "out/loop/${id}_0.png" "out/loop/${id}_600.png"; then echo "$id: frame 0 == frame 600"; else echo "$id: LOOP BREAKS"; fi
done
