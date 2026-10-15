#!/usr/bin/env bash
# Render one 720p preview: full PNG sequence (Remotion, --scale=1/3, out of
# order across threads), then encode H.264 yuv420p CRF 16 at 30 fps.
# usage: scripts/render-preview.sh <CompositionId> <OutputName>
set -euo pipefail
ID="$1"; NAME="$2"
FR="out/frames/$NAME"; mkdir -p "$FR" out/previews out/timing
# RESUME=1 keeps existing frames and renders only the missing ones (frames are
# deterministic, so a resumed sequence is identical to an uninterrupted one).
[ "${RESUME:-0}" = "1" ] || rm -f "$FR"/*.png
START=$(date +%s.%N)
FIRST=0
while [ -f "$FR/element-$(printf %03d $FIRST).png" ] && [ $FIRST -lt 600 ]; do FIRST=$((FIRST+1)); done
if [ $FIRST -lt 600 ]; then
  npx remotion render "${BUNDLE:-out/bundle}" "$ID" "$FR" --sequence --image-format=png \
    --scale=0.3333333333333333 --log=error --frames=$FIRST-599
fi
END=$(date +%s.%N)
N=$((600 - FIRST))
echo "$NAME frames=$N seconds=$(echo "$END - $START" | bc) per_frame=$(echo "scale=3; ($END - $START) / $N" | bc)" | tee out/timing/$NAME.txt
ffmpeg -v error -y -framerate 30 -i "$FR/element-%03d.png" -c:v libx264 -crf 16 -pix_fmt yuv420p \
  -preset slow -an -movflags +faststart "out/previews/$NAME.mp4"
