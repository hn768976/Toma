#!/usr/bin/env bash
# Render the 720p previews (H.264, yuv420p, CRF 16, 30 fps) and a 720p PNG
# still of every composition. Usage: scripts/render-previews.sh [CompId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${OUT:-out/previews}
SCALE=0.3333333333333333
mkdir -p "$OUT"
npx remotion bundle --out-dir=out/bundle >/dev/null
IDS=("$@")
if [ ${#IDS[@]} -eq 0 ]; then
  IDS=(RetroMountains-Sunset RetroMountains-Midnight GlassSpiral-Blue GlassSpiral-Amber ParticleSmoke-White FibreTunnel-RedCyan FibreTunnel-VioletGold)
fi
for id in "${IDS[@]}"; do
  name=${id/-/_}
  start=$(date +%s.%N)
  npx remotion render out/bundle "$id" "$OUT/$name.mp4" \
    --scale=$SCALE --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 \
    --image-format=png --muted --concurrency=4 --log=error
  end=$(date +%s.%N)
  echo "$id $(echo "$end - $start" | bc)" >> "$OUT/render-times.txt"
  npx remotion still out/bundle "$id" "$OUT/$name.png" --frame=150 --scale=$SCALE --gl=angle --log=error
  echo "rendered $id"
done
