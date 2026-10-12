#!/usr/bin/env bash
# Renders 1280×720 previews (H.264, yuv420p, 30fps, CRF 16, no audio) and a
# 720p PNG still of each. Usage: scripts/render-previews.sh [comp-id ...]
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/comps.sh
mkdir -p out/previews out/stills out/logs
npx remotion bundle --out-dir build >/dev/null
for entry in "${COMPS[@]}"; do
  id="${entry%%:*}"; stem="${entry##*:}"
  if [ $# -gt 0 ] && [[ ! " $* " =~ " $id " ]]; then continue; fi
  start=$(date +%s.%N)
  npx remotion render build "$id" "out/previews/$stem.mp4" --scale=$SCALE --crf=16 \
    --pixel-format=yuv420p --codec=h264 --muted --gl=angle --concurrency=4 >"out/logs/$stem.log" 2>&1
  end=$(date +%s.%N)
  dims=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "out/previews/$stem.mp4")
  if [ "$dims" != "1280,720" ]; then echo "$stem: unexpected size $dims" >&2; exit 1; fi
  npx remotion still build "$id" "out/stills/$stem.png" --frame=150 --scale=$SCALE --gl=angle >/dev/null 2>&1
  printf "%-28s %6.1fs total  %6.1f ms/frame (4 tabs)\n" "$stem" "$(echo "$end - $start" | bc)" "$(echo "($end - $start) * 1000 / 600" | bc -l)"
done
