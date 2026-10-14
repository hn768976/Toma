#!/usr/bin/env bash
# Render the 720p previews (H.264, yuv420p, 30 fps, CRF 16) and log wall time.
# usage: scripts/render-previews.sh [comp-id ...]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=out/previews
mkdir -p "$OUT"
IDS=${*:-"AIHudPlane-Violet AIHudPlane-Teal ParticleAIChip-Blue AIChipReveal-Blue AIChipReveal-Amber"}
npx remotion bundle src/index.ts --out-dir=out/bundle >/dev/null 2>&1 || true
for id in $IDS; do
  name=${id/-/_}
  start=$(date +%s.%N)
  npx remotion render out/bundle "$id" "$OUT/$name.mp4" \
    --scale=0.3333333333333333 --codec=h264 --crf=16 --pixel-format=yuv420p \
    --concurrency=4 --muted --log=error
  end=$(date +%s.%N)
  frames=$(ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of csv=p=0 "$OUT/$name.mp4")
  echo "$name frames=$frames wall=$(echo "$end - $start" | bc)s per_frame=$(echo "scale=3; ($end - $start) / $frames" | bc)s (concurrency 4)" | tee -a "$OUT/render-times.txt"
done
