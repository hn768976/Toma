#!/usr/bin/env bash
# Render the 720p previews (1280x720, H.264, yuv420p, CRF 16, no audio).
# Usage: scripts/render-previews.sh [out-dir]   (extra args are passed to remotion, e.g. --browser-executable=...)
set -euo pipefail
OUT=${1:-out/preview}; shift || true
mkdir -p "$OUT"
npx remotion bundle src/index.ts --out-dir=build >/dev/null
for id in DoodleArrows CirclesHighlights UnderlinesStrikes StarsSparkles SpeechBubbles ScribbleWipe BrushStrokeReveal TitleFrame LikeSubscribe Countdown; do
  start=$(date +%s.%N)
  npx remotion render build "GS-$id" "$OUT/GS_$id.mp4" --scale=0.3333333333333333 \
    --codec=h264 --pixel-format=yuv420p --crf=16 --muted "$@"
  echo "GS_$id rendered in $(echo "$(date +%s.%N) - $start" | bc) s"
done
