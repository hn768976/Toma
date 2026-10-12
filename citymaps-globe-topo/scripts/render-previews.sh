#!/usr/bin/env bash
# Render 720p previews (1280x720, H.264, yuv420p, CRF 16) of the given
# compositions (default: all nine) and log wall time per composition.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${OUT:-out/previews}
mkdir -p "$OUT"
IDS=${*:-"CityHUD-SteelBlue CityFlyover-Teal CityFlyover-Amber CityTracker-Teal WorldConnections-Blue WorldConnections-Gold HUDGlobe-Teal TopoContours-GreenOrange TopoContours-IceBlue"}
for id in $IDS; do
  name=${id/-/_}
  t0=$(date +%s.%N)
  npx remotion render "$id" "$OUT/$name.mp4" --scale=0.3333333333333333 --crf=16 --pixel-format=yuv420p \
    --image-format=png --concurrency=${CONC:-4} --log=error
  t1=$(date +%s.%N)
  echo "$id $(echo "$t1 - $t0" | bc)" | tee -a "$OUT/render-times.txt"
done
