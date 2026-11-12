#!/usr/bin/env bash
# Renders the 720p previews (1280x720, H.264, yuv420p, CRF 12) of all 8 clips into out/.
# Usage: scripts/render-previews.sh [ids...]   (env GL=angle|swangle, default angle)
set -euo pipefail
cd "$(dirname "$0")/.."
IDS=${@:-"ScratchGrunge_Black ScratchGrunge_White PhotocopyGrunge_White PhotocopyGrunge_Black CharcoalGrunge_White CharcoalGrunge_Orange BrushFrame_White BrushFrame_Black"}
mkdir -p out
npx remotion bundle --out-dir=build --log=error >/dev/null
for id in $IDS; do
  comp=${id/_/-}
  start=$(date +%s.%N)
  npx remotion render build "$comp" "out/$id.mp4" --scale=0.3333333333333333 --gl="${GL:-angle}" \
    --codec=h264 --pixel-format=yuv420p --crf=12 --image-format=png --muted --log=error ${CONCURRENCY:+--concurrency=$CONCURRENCY}
  end=$(date +%s.%N)
  echo "$id $(echo "$end - $start" | bc) s total, $(echo "scale=1; ($end - $start) * 1000 / 600" | bc) ms/frame" | tee -a out/timings.txt
done
