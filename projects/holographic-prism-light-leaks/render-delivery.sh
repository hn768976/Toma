#!/usr/bin/env bash
# Renders the two 4K compositions to the 1080p H.264 delivery files.
# shaderScale=0.5 + --scale=0.5  => the shader is evaluated at exactly 1920x1080.
set -euo pipefail
OUT_DIR="${1:-out}"
mkdir -p "$OUT_DIR"
npx remotion render HoloPrism-V1-Match-4K \
  "$OUT_DIR/Version-1_Holographic-Prism-Light-Leaks_1080p.mp4" \
  --props='{"variant":"match","shaderScale":0.5}' --scale=0.5 \
  --codec=h264 --crf=16 --pixel-format=yuv420p --timeout=240000
npx remotion render HoloPrism-V2-LowAngleTracking-4K \
  "$OUT_DIR/Version-2_Holographic-Prism-Light-Leaks_Low-Angle-Tracking-Camera_1080p.mp4" \
  --props='{"variant":"camera","shaderScale":0.5}' --scale=0.5 \
  --codec=h264 --crf=16 --pixel-format=yuv420p --timeout=240000
