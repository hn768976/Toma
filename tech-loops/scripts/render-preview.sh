#!/usr/bin/env bash
# Usage: scripts/render-preview.sh <CompositionId> <FileStem>
# Full 720p render as a lossless PNG sequence (kept for the frame-300 determinism
# check), then H.264 / yuv420p / CRF 16 / 30 fps, no audio, plus a 720p still.
set -euo pipefail
cd "$(dirname "$0")/.."
ID="$1"; STEM="$2"
FR="out/frames/$ID"
rm -rf "$FR"; mkdir -p "$FR" out/previews out/stills out/timings
START=$(date +%s.%N)
npx remotion render "$ID" "$FR" --sequence --image-format=png --scale=0.3333333333333333 --concurrency=4 > "out/timings/$ID.log" 2>&1
END=$(date +%s.%N)
echo "$ID wall=$(echo "$END - $START" | bc) frames=600" | tee -a out/timings/summary.txt
ffmpeg -v error -y -framerate 30 -i "$FR/element-%03d.png" -c:v libx264 -preset slow -crf 16 -x264-params aq-mode=3:aq-strength=1.4:deadzone-inter=0:deadzone-intra=0 -pix_fmt yuv420p -r 30 -an -movflags +faststart "out/previews/$STEM.mp4" < /dev/null
cp "$FR/element-300.png" "out/stills/$STEM.png"
