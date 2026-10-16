#!/bin/bash
# Render one 720p preview: a full multi-threaded PNG sequence (frames rendered
# out of order across threads), encoded to H.264 / yuv420p / CRF 16, plus
# the frame-300 PNG still. Usage: scripts/render-preview.sh NebulaLens_Pastel
set -euo pipefail
NAME="$1"; ID="${NAME//_/-}"
cd "$(dirname "$0")/.."
OUT=renders; SEQ="$OUT/seq/$NAME"; mkdir -p "$OUT" "$SEQ"
[ -d build ] || npx remotion bundle --out-dir=build --log=error
START=$(date +%s.%N)
npx remotion render build "$ID" "$SEQ" --sequence --image-format=png \
  --scale=0.3333333333333333 --concurrency=4 --log=error
END=$(date +%s.%N)
echo "$NAME render: $(echo "$END - $START" | bc) s for 600 frames (concurrency 4)" | tee -a "$OUT/timings.txt"
ffmpeg -v error -y -framerate 30 -i "$SEQ/element-%03d.png" -c:v libx264 -crf 16 -pix_fmt yuv420p \
  -preset slow -movflags +faststart -an "$OUT/$NAME.mp4"
cp "$SEQ/element-300.png" "$OUT/$NAME.png"
