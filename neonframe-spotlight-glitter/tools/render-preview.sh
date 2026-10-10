#!/bin/bash
# Render a 1280x720 preview of one composition:
#   Remotion renders a PNG sequence at --scale=1/3 (frames are rendered out of order on
#   several threads, exactly like a normal render); ffmpeg encodes H.264 yuv420p CRF 16.
# usage: tools/render-preview.sh <CompositionId> <out.mp4> [workdir]
set -euo pipefail
ID=$1; OUT=$2; WORK=${3:-out/frames/$ID}
mkdir -p "$WORK" "$(dirname "$OUT")"
START=$(date +%s)
npx remotion render src/index.ts "$ID" --sequence --image-format=png --scale=0.3333333333333333 \
  --gl=angle --concurrency=${CONCURRENCY:-4} --output="$WORK" --log=error
MID=$(date +%s)
ffmpeg -v error -y -framerate 30 -i "$WORK/element-%03d.png" -c:v libx264 -preset slow -crf 16 \
  -pix_fmt yuv420p -r 30 -an -movflags +faststart "$OUT"
END=$(date +%s)
echo "$ID render=$((MID-START))s encode=$((END-MID))s"
