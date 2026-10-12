#!/usr/bin/env bash
# Render one 720p preview: Remotion renders lossless PNG frames at --scale=1/3
# (3840x2160 -> 1280x720), then ffmpeg encodes H.264 CRF 16 yuv420p, no audio.
# Keeping the PNG frames lets the verification compare frames byte for byte.
# Usage: scripts/render-preview.sh <CompositionId> <OutName> [bundleDir]
set -euo pipefail
ID="$1"; NAME="$2"; BUNDLE="${3:-}"
OUT="out/previews"; FR="out/frames/$NAME"
mkdir -p "$OUT" "$FR"
rm -f "$FR"/*.png
SRC="${BUNDLE:-src/index.ts}"
start=$(date +%s)
npx remotion render "$SRC" "$ID" "$FR" --sequence --image-format=png \
  --scale=0.3333333333333333 --concurrency=4 --log=error
mid=$(date +%s)
ffmpeg -v error -y -framerate 30 -i "$FR/element-%03d.png" \
  -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -r 30 -an \
  -movflags +faststart "$OUT/$NAME.mp4"
end=$(date +%s)
echo "$NAME frames=$(ls "$FR" | wc -l) render_s=$((mid-start)) encode_s=$((end-mid))" | tee -a out/render-times.txt
