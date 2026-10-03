#!/usr/bin/env bash
# Step 3: render frame 200 of each composition on its own from a cold start
# (a fresh `remotion still`) and compare it byte-for-byte with frame 200 of
# the full multi-threaded sequence render in out/seq/.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/determinism
ALL="GlitterSmoke-Blue GlitterSmoke-VioletGold NeonPolygonFrame CrowdSpotlight-Blue CrowdSpotlight-Gold AIBrainPaths GlassTwist-IceBlue GlassTwist-Blush"
for id in ${*:-$ALL}; do
  name=${id//-/_}
  full=$(ls out/seq/$name/*200.png | head -1)
  cold=out/determinism/${name}_200.png
  npx remotion still "$id" "$cold" --frame=200 --scale=0.3333333333333333 --image-format=png --log=error >/dev/null 2>&1
  if cmp -s "$full" "$cold"; then echo "$id frame 200: IDENTICAL (byte for byte)"; else echo "$id frame 200: DIFFERENT"; fi
done
