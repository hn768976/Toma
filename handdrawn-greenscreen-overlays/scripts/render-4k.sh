#!/usr/bin/env bash
# Render all ten overlays at full 3840x2160 (H.264, yuv420p, CRF 16, no audio).
# Usage: scripts/render-4k.sh [out-dir]   (extra args are passed to remotion)
set -euo pipefail
OUT=${1:-out/4k}; shift || true
mkdir -p "$OUT"
npx remotion bundle src/index.ts --out-dir=build >/dev/null
for id in DoodleArrows CirclesHighlights UnderlinesStrikes StarsSparkles SpeechBubbles ScribbleWipe BrushStrokeReveal TitleFrame LikeSubscribe Countdown; do
  npx remotion render build "GS-$id" "$OUT/GS_$id.mp4" --codec=h264 --pixel-format=yuv420p --crf=16 --muted "$@"
done
