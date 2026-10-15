#!/usr/bin/env bash
# Render one 720p preview: full PNG sequence (Remotion, --scale=1/3, out of
# order across threads), then encode H.264 yuv420p CRF 16 at 30 fps.
# usage: scripts/render-preview.sh <CompositionId> <OutputName>
set -euo pipefail
ID="$1"; NAME="$2"
FR="out/frames/$NAME"; mkdir -p "$FR" out/previews out/timing
rm -f "$FR"/*.png
START=$(date +%s.%N)
npx remotion render "${BUNDLE:-out/bundle}" "$ID" "$FR" --sequence --image-format=png \
  --scale=0.3333333333333333 --log=error
END=$(date +%s.%N)
N=$(ls "$FR"/*.png | wc -l)
echo "$NAME frames=$N seconds=$(echo "$END - $START" | bc) per_frame=$(echo "scale=3; ($END - $START) / $N" | bc)" | tee out/timing/$NAME.txt
ffmpeg -v error -y -framerate 30 -i "$FR/element-%03d.png" -c:v libx264 -crf 16 -pix_fmt yuv420p \
  -preset slow -an -movflags +faststart "out/previews/$NAME.mp4"
