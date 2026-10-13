#!/bin/bash
# render-preview.sh <CompositionId> <OutName>
# Full 720p render as a PNG sequence (kept for the determinism check), then
# encoded to H.264 / yuv420p / 30 fps / CRF 16 with no audio.
set -e
ID=$1; NAME=$2
mkdir -p out/frames/$ID out/previews
npx remotion render $ID out/frames/$ID --sequence --image-format=png \
  --scale=0.3333333333333333 --concurrency=2 --log=error
first=$(ls out/frames/$ID | head -1)
pattern=$(echo "$first" | sed -E 's/[0-9]+\.png$//')
digits=$(echo "$first" | sed -E 's/.*[^0-9]([0-9]+)\.png$/\1/' | tr -d '\n' | wc -c)
ffmpeg -v error -y -framerate 30 -i "out/frames/$ID/${pattern}%0${digits}d.png" \
  -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30 -movflags +faststart -an out/previews/$NAME.mp4
echo "done $NAME"
