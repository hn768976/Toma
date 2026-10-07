#!/usr/bin/env bash
# Renders the five 720p preview mp4s (1280x720, H.264 yuv420p, 30 fps, CRF 16) and logs wall time.
# usage: scripts/render-previews.sh [concurrency]
set -uo pipefail
CONC="${1:-3}"; SCALE=0.3333333333333333
mkdir -p deliverables out
declare -A FILE=( [GlitchDotMap-Mono]=GlitchDotMap_Mono [LightStreaks-BlueMagenta]=LightStreaks_BlueMagenta [LightStreaks-Gold]=LightStreaks_Gold [RateBoard-Red]=RateBoard_Red [RateBoard-Blue]=RateBoard_Blue )
for ID in GlitchDotMap-Mono LightStreaks-BlueMagenta LightStreaks-Gold RateBoard-Red RateBoard-Blue; do
  START=$(date +%s)
  npx remotion render "$ID" "deliverables/${FILE[$ID]}.mp4" --scale=$SCALE --codec=h264 --pixel-format=yuv420p --crf=16 \
    --image-format=png --concurrency="$CONC" > "out/render_${ID}.log" 2>&1
  RC=$?
  END=$(date +%s)
  echo "$ID rc=$RC wall=$((END-START))s" | tee -a out/render_times.txt
done
echo ALL_DONE >> out/render_times.txt
