#!/usr/bin/env bash
# Render a 720p preview: full PNG sequence (kept for the determinism check),
# then encode H.264 / yuv420p / 30 fps / CRF 16, no audio.
# usage: scripts/render-preview.sh <compositionId> <outName.mp4> [gl]
set -euo pipefail
ID=$1; OUT=$2; GL=${3:-angle}
mkdir -p renders
SEQ=renders/${ID}_png
rm -rf "$SEQ"
start=$(date +%s)
npx remotion render "$ID" "$SEQ" --sequence --image-format=png \
  --scale=0.3333333333333333 --gl="$GL" --log=error
end=$(date +%s)
N=$(ls "$SEQ" | wc -l)
FIRST=$(ls "$SEQ" | head -1 | sed -E 's/element-0*([0-9]+)\.png/\1/'); FIRST=${FIRST:-0}
PAD=$(ls "$SEQ" | head -1 | sed -E 's/element-([0-9]+)\.png/\1/' | tr -d '\n' | wc -c)
ffmpeg -v error -y -framerate 30 -start_number 0 -i "$SEQ/element-%0${PAD}d.png" \
  -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -r 30 -an -movflags +faststart "renders/$OUT"
echo "$ID: $N frames in $((end-start)) s => $(echo "scale=3; ($end-$start)/$N" | bc) s/frame"
