#!/usr/bin/env bash
# 1080p preview deliverables. 4K is rendered separately -- see README.md.
set -euo pipefail
cd "$(dirname "$0")/.."
# --image-format=png keeps the frames out of a JPEG round-trip on the way to
# H.264: this piece is soft dark gradients and 2.5% grain, which is exactly
# what JPEG intermediates mush. --color-space=bt709 pairs with
# --pixel-format=yuv420p to tag limited range, instead of the full-range
# yuvj420p that JPEG frames produce. --muted drops a silent audio track.
render() {
  npx remotion render "$1" "out/$2.mp4" --scale=0.5 --crf=16 \
    --pixel-format=yuv420p --image-format=png --color-space=bt709 --muted
  npx remotion still "$1" "out/$2.png" --frame=210 --scale=0.5
}
render V1-FoggyForestTeal  V1_FoggyForestTeal
render V2-FoggyForestAmber V2_FoggyForestAmber
render V3-FoggyForestMono  V3_FoggyForestMono
echo "ALL RENDERS COMPLETE"
