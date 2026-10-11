#!/usr/bin/env bash
# Render all 8 previews at 1280x720 (H.264, yuv420p, CRF 16) and a PNG still of each.
# Usage: scripts/render-previews.sh [CompositionId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=out/previews
mkdir -p "$OUT"
declare -A NAME=(
  [WindFarmHologram-Blue]=WindFarmHologram_Blue
  [WindFarmHologram-Green]=WindFarmHologram_Green
  [PrismDispersion-Dark]=PrismDispersion_Dark
  [MagneticTorus-PinkViolet]=MagneticTorus_PinkViolet
  [BarMagnets-Attract]=BarMagnets_Attract
  [BarMagnets-Repel]=BarMagnets_Repel
  [ElectricField-OppositeCharges]=ElectricField_OppositeCharges
  [ElectricField-LikeCharges]=ElectricField_LikeCharges
)
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && IDS=(WindFarmHologram-Blue WindFarmHologram-Green PrismDispersion-Dark MagneticTorus-PinkViolet BarMagnets-Attract BarMagnets-Repel ElectricField-OppositeCharges ElectricField-LikeCharges)
npx remotion bundle src/index.ts --out-dir=out/bundle >/dev/null
for id in "${IDS[@]}"; do
  n=${NAME[$id]}
  s=$(date +%s)
  npx remotion render out/bundle "$id" "$OUT/$n.mp4" --scale=0.3333333333333333 \
    --codec=h264 --crf=16 --pixel-format=yuv420p --concurrency="${CONC:-4}" --muted >/dev/null
  e=$(date +%s)
  echo "$id render_s=$((e - s)) per_frame_s=$(echo "scale=3; ($e - $s) / 600" | bc)" | tee -a "$OUT/timings.txt"
  npx remotion still out/bundle "$id" "$OUT/$n.png" --frame=150 --scale=0.3333333333333333 >/dev/null
done
