#!/usr/bin/env bash
# Step 2: with loopCheck (601 frames), frame 0 and frame 600 must be identical.
# Step 3: frame 300 rendered alone from a cold start must match frame 300 of a
#         multi-tab render (PNG sequence, frames rendered out of order across
#         4 tabs) byte for byte.
set -uo pipefail
cd "$(dirname "$0")/.."
OUT=${OUT:-out/checks}
mkdir -p "$OUT"
IDS=${*:-"CityHUD-SteelBlue CityFlyover-Teal CityFlyover-Amber CityTracker-Teal WorldConnections-Blue WorldConnections-Gold HUDGlobe-Teal TopoContours-GreenOrange TopoContours-IceBlue"}
S="--scale=0.3333333333333333 --log=error"
for id in $IDS; do
  npx remotion still "$id" "$OUT/$id-loop-000.png" --frame=0 --props='{"loopCheck":true}' $S
  npx remotion still "$id" "$OUT/$id-loop-600.png" --frame=600 --props='{"loopCheck":true}' $S
  loop=$(python3 scripts/verify.py same "$OUT/$id-loop-000.png" "$OUT/$id-loop-600.png" >/dev/null && echo PASS || echo FAIL)
  npx remotion still "$id" "$OUT/$id-cold-300.png" --frame=300 $S
  rm -rf "$OUT/$id-seq"
  npx remotion render "$id" "$OUT/$id-seq" --sequence --image-format=png --frames=280-319 --concurrency=4 $S
  seqf=$(ls "$OUT/$id-seq" | grep -E '0*300\.png$' | head -1)
  if cmp -s "$OUT/$id-cold-300.png" "$OUT/$id-seq/$seqf"; then det=PASS; else det=FAIL; fi
  echo "$id loop=$loop determinism=$det" | tee -a "$OUT/results.txt"
done
