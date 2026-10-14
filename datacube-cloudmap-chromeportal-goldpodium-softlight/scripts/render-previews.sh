#!/usr/bin/env bash
# Render 720p previews (H.264, yuv420p, CRF 16, 30fps) + one 720p PNG still each.
# Usage: scripts/render-previews.sh [CompId ...]   (default: all 8)
set -euo pipefail
cd "$(dirname "$0")/.."
GL="${GL:-angle}"
SCALE=0.3333333333333333
OUT=out/previews
mkdir -p "$OUT" out/logs
ALL=(DataCube-Blue CloudMap-Story ChromePortal-Silver ChromePortal-Gold GoldRibbonPodium-RedGold GoldRibbonPodium-EmeraldGold SoftLight-Blue SoftLight-Violet)
IDS=("${@:-${ALL[@]}}")
[ $# -eq 0 ] && IDS=("${ALL[@]}")
for id in "${IDS[@]}"; do
  name="${id//-/_}"
  frames=600; still=300
  [ "$id" = "CloudMap-Story" ] && frames=300 && still=150
  start=$(date +%s.%N)
  npx remotion render src/index.ts "$id" "$OUT/$name.mp4" --scale=$SCALE --gl="$GL" \
    --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted \
    --concurrency="${CONC:-4}" --log=error > "out/logs/$name.render.log" 2>&1
  end=$(date +%s.%N)
  secs=$(echo "$end - $start" | bc)
  per=$(echo "scale=3; $secs / $frames" | bc)
  echo "$id frames=$frames wall=${secs}s per_frame=${per}s" | tee -a out/logs/timings.txt
  npx remotion still src/index.ts "$id" "$OUT/$name.png" --frame=$still --scale=$SCALE --gl="$GL" --log=error > /dev/null 2>&1
  ffprobe -v error -show_entries stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt \
    -show_entries format=duration -of default=noprint_wrappers=1 "$OUT/$name.mp4" | tr '\n' ' '; echo
done
