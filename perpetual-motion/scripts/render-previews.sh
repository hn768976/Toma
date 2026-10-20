#!/usr/bin/env bash
# 720p previews of all five loops: 1280×720, H.264, yuv420p, 30 fps, CRF 16.
# Usage: bash scripts/render-previews.sh [Name ...]   (default: all five)
set -euo pipefail
cd "$(dirname "$0")/.."
names=("$@")
[ ${#names[@]} -eq 0 ] && names=(OverbalancedWheel WaterScrewMill SelfFlowingFlask MagnetRamp RollingBallWheel)
mkdir -p renders/previews
for n in "${names[@]}"; do
  start=$(date +%s.%N)
  npx remotion render src/index.ts "PerpetualMotion-$n" "renders/previews/PerpetualMotion_$n.mp4" \
    --scale=0.3333333333333333 --codec=h264 --crf=16 --pixel-format=yuv420p --muted \
    --concurrency=4 --log=error
  end=$(date +%s.%N)
  echo "$n: $(echo "$end - $start" | bc) s total, $(echo "($end - $start) * 1000 / 600" | bc) ms/frame"
done
