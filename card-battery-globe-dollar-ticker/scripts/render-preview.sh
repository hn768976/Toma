#!/usr/bin/env bash
# Render one composition as a 720p preview:
#   1. Remotion → PNG sequence at --scale=1/3 (1280×720), lossless frames
#   2. scripts/encode.sh → H.264 yuv420p CRF 16, 30 fps, no audio (-tune grain)
# Keeping the PNGs lets the determinism check compare frames byte for byte.
#   scripts/render-preview.sh <CompositionId> <OutputName> [concurrency]
set -euo pipefail
ID=$1; NAME=$2; CONC=${3:-2}
FR=out/frames/$ID
rm -rf "$FR"; mkdir -p "$FR" out/previews out/logs
start=$(date +%s)
npx remotion render build/bundle "$ID" "$FR" --sequence --image-format=png \
  --scale=0.3333333333333333 --concurrency="$CONC" --gl=angle > "out/logs/$ID.log" 2>&1
end=$(date +%s)
n=$(ls "$FR" | wc -l)
echo "$ID: $n frames in $((end-start)) s → $(echo "scale=2; ($end-$start)/$n" | bc) s/frame (concurrency $CONC)" | tee -a out/logs/timing.txt
scripts/encode.sh "$ID" "$NAME"
echo "wrote out/previews/$NAME.mp4"
