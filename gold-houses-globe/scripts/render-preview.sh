#!/usr/bin/env bash
# Render one composition as a 720p preview:
#   1. full PNG frame sequence (lossless; also used for the determinism check)
#   2. H.264 / yuv420p / CRF 16 / 30 fps mp4 encoded from those frames
#   3. a 720p PNG still
# usage: scripts/render-preview.sh <CompositionId> <OutName> <StillFrame>
# env:   BROWSER_EXECUTABLE (optional) - Chromium/headless-shell to use
set -euo pipefail
ID=$1; NAME=$2; STILL=$3
BX=(); [ -n "${BROWSER_EXECUTABLE:-}" ] && BX=(--browser-executable="$BROWSER_EXECUTABLE")
FR="out/frames/$NAME"
mkdir -p out/previews out/stills out/timing
rm -rf "$FR"
t0=$(date +%s.%N)
npx remotion render src/index.ts "$ID" "$FR" --sequence --image-format=png \
  --scale=0.3333333333333333 --gl=angle --concurrency=2 "${BX[@]}" --log=error
t1=$(date +%s.%N)
N=$(ls "$FR" | wc -l)
echo "$NAME frames=$N total_s=$(echo "$t1 - $t0" | bc)" | tee "out/timing/$NAME.txt"
ffmpeg -v error -y -framerate 30 -pattern_type glob -i "$FR/element-*.png" \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart \
  "out/previews/$NAME.mp4"
cp "$FR/$(ls "$FR" | sed -n "$((STILL + 1))p")" "out/stills/$NAME.png"
