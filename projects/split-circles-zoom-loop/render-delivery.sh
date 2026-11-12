#!/usr/bin/env bash
# Renders the two 4K compositions down to the 1080p H.264 delivery files.
set -euo pipefail
OUT_DIR="${1:-out}"
mkdir -p "$OUT_DIR"
npx remotion render SplitCircles-V1-Match-4K \
  "$OUT_DIR/Version-1_Split-Circles-Zoom-Loop_1080p.mp4" \
  --scale=0.5 --codec=h264 --crf=16 --pixel-format=yuv420p --color-space=bt709
npx remotion render SplitCircles-V2-CobaltAqua-4K \
  "$OUT_DIR/Version-2_Split-Circles-Zoom-Loop_Cobalt-Aqua-Palette_1080p.mp4" \
  --scale=0.5 --codec=h264 --crf=16 --pixel-format=yuv420p --color-space=bt709
