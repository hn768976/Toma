#!/usr/bin/env bash
# Render the six 720p previews (H.264, yuv420p, CRF 16, 30fps) and a 720p PNG still of each.
# Usage: scripts/render-previews.sh [CompositionId ...]   (default: all six)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${OUT:-renders}
mkdir -p "$OUT"
SCALE=0.3333333333333333
declare -A STILL=( [Wormhole-Violet]=104 [Wormhole-CyanGold]=104 [CoinGrowth]=300 [HologramThreatMap]=200 [SparkleBurst-Blue]=66 [SparkleBurst-Gold]=66 )
COMPS=("$@"); [ ${#COMPS[@]} -eq 0 ] && COMPS=(Wormhole-Violet Wormhole-CyanGold CoinGrowth HologramThreatMap SparkleBurst-Blue SparkleBurst-Gold)
for c in "${COMPS[@]}"; do
  f=${c//-/_}
  start=$(date +%s.%N)
  npx remotion render "$c" "$OUT/$f.mp4" --scale=$SCALE --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted --disallow-parallel-encoding
  end=$(date +%s.%N)
  frames=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$OUT/$f.mp4")
  echo "$c $(echo "($end-$start)/$frames" | bc -l | cut -c1-5) s/frame (720p, whole render incl. bundling)" | tee -a "$OUT/render-times.txt"
  npx remotion still "$c" "$OUT/$f.png" --frame=${STILL[$c]} --scale=$SCALE
done
