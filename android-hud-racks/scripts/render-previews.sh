#!/usr/bin/env bash
# Renders the 720p previews. Each composition is rendered as a full PNG
# sequence (frames rendered out of order on several tabs), then encoded with
# ffmpeg: H.264, yuv420p, 30 fps, CRF 16. Frame 300 of the sequence is kept
# for the cold-start determinism check (scripts/determinism-check.sh).
#
#   scripts/render-previews.sh [outDir] [composition ...]
set -euo pipefail
OUT=${1:-out}
shift || true
COMPS=("$@")
if [ ${#COMPS[@]} -eq 0 ]; then
  COMPS=(AndroidTraderHUD-Left AndroidTraderHUD-Right GrowthChartHUD-Story ServerRack-FrontScroll ServerRack-DiagonalGlide ServerRack-LowAngle)
fi
declare -A NAME=(
  [AndroidTraderHUD-Left]=AndroidTraderHUD_Left
  [AndroidTraderHUD-Right]=AndroidTraderHUD_Right
  [GrowthChartHUD-Story]=GrowthChartHUD_Story
  [ServerRack-FrontScroll]=ServerRack_FrontScroll
  [ServerRack-DiagonalGlide]=ServerRack_DiagonalGlide
  [ServerRack-LowAngle]=ServerRack_LowAngle
)
mkdir -p "$OUT/frames" "$OUT/timing"
for c in "${COMPS[@]}"; do
  n=${NAME[$c]}
  seq="$OUT/frames/$n"
  rm -rf "$seq"
  start=$(date +%s.%N)
  npx remotion render "$c" --sequence --image-format=png --scale=0.3333333333333333 \
    --concurrency=${CONCURRENCY:-2} "$seq" > "$OUT/timing/$n.log" 2>&1
  end=$(date +%s.%N)
  frames=$(ls "$seq" | wc -l)
  echo "$c $frames frames $(echo "$end - $start" | bc) s" | tee -a "$OUT/timing/summary.txt"
  first=$(ls "$seq" | head -1)
  digits=$(echo "$first" | sed -E 's/element-([0-9]+)\.png/\1/' | tr -d '\n' | wc -c)
  ffmpeg -v error -y -framerate 30 -i "$seq/element-%0${digits}d.png" \
    -c:v libx264 -crf 16 -pix_fmt yuv420p -preset slow -movflags +faststart \
    -r 30 "$OUT/$n.mp4"
  cp "$seq/element-$(printf "%0${digits}d" 300).png" "$OUT/frames/$n-300-full.png"
  rm -rf "$seq"
done
