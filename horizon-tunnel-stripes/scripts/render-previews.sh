#!/usr/bin/env bash
# Render 720p previews (mp4 + PNG still) of every composition.
# Usage: scripts/render-previews.sh [CompositionId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
SCALE=0.3333333333333333
OUT=${OUT:-out/previews}
mkdir -p "$OUT"
ALL="EarthHorizon-Blue EarthHorizon-Gold NeonGridTunnel-Blue NeonGridTunnel-Magenta HierarchyNetwork DiagonalSlats-Black DiagonalSlats-White SpeedTrails"
IDS=${*:-$ALL}
npx remotion bundle --out-dir=build >/dev/null
for id in $IDS; do
  name=${id/-/_}
  still=200
  [ "$id" = "HierarchyNetwork" ] && still=300
  start=$(date +%s.%N)
  npx remotion render build "$id" "$OUT/$name.mp4" --scale=$SCALE --concurrency=2 >/dev/null
  end=$(date +%s.%N)
  frames=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$OUT/$name.mp4")
  echo "$id frames=$frames sec_per_frame=$(echo "($end-$start)/$frames" | bc -l | cut -c1-5)" | tee -a "$OUT/timings.txt"
  npx remotion still build "$id" "$OUT/$name.png" --frame=$still --scale=$SCALE >/dev/null
done
