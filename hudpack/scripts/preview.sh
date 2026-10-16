#!/usr/bin/env bash
# Render one composition's 720p preview: a PNG sequence through Remotion at
# --scale=1/3 (so the full render is kept for byte-for-byte checks), then an
# H.264 / yuv420p / CRF 16 / 30 fps mp4 encoded from exactly those frames.
#   scripts/preview.sh StockScreen-Teal [concurrency]
set -euo pipefail
ID="$1"
CONC="${2:-2}"
NAME="${ID/-/_}"
mkdir -p renders/frames renders/logs deliverables
FR="renders/frames/$NAME"
rm -rf "$FR"
START=$(date +%s.%N)
npx remotion render "$ID" "$FR" --sequence --image-format=png \
  --scale=0.3333333333333333 --concurrency="$CONC" --log=info > "renders/logs/$NAME.log" 2>&1
END=$(date +%s.%N)
N=$(ls "$FR" | wc -l)
echo "$NAME frames=$N seconds=$(echo "$END - $START" | bc) per_frame_ms=$(echo "($END - $START) * 1000 / $N" | bc) concurrency=$CONC" | tee -a renders/timings.txt
FIRST=$(ls "$FR" | head -1)
PATTERN="$FR/$(echo "$FIRST" | sed -E 's/[0-9]+\.png$//')%0$(echo "$FIRST" | sed -E 's/^[^0-9]*([0-9]+)\.png$/\1/' | wc -c | awk '{print $1-1}')d.png"
ffmpeg -v error -y -framerate 30 -start_number 0 -i "$PATTERN" -c:v libx264 -preset slow -crf 16 \
  -pix_fmt yuv420p -r 30 -an -movflags +faststart "deliverables/$NAME.mp4"
echo "encoded deliverables/$NAME.mp4"
