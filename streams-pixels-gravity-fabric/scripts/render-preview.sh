#!/usr/bin/env bash
# Render a 720p preview: PNG sequence (kept for the determinism check) -> H.264 mp4.
# usage: scripts/render-preview.sh <CompositionId> <OutputName>   e.g. LightStreams-Blue LightStreams_Blue
set -euo pipefail
ID="$1"; NAME="$2"
OUT="${OUT:-out}"
mkdir -p "$OUT/frames/$ID" "$OUT/previews"
start=$(date +%s.%N)
npx remotion render "${BUNDLE:-src/index.ts}" "$ID" "$OUT/frames/$ID" --sequence --image-format=png \
  --scale=0.3333333333333333 --gl="${GL:-angle}" --concurrency="${CONC:-4}" --log=error
end=$(date +%s.%N)
echo "$ID render seconds: $(echo "$end - $start" | bc)" | tee -a "$OUT/render-times.txt"
ffmpeg -v error -y -framerate 30 -i "$OUT/frames/$ID/element-%03d.png" \
  -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -r 30 -an -movflags +faststart \
  "$OUT/previews/$NAME.mp4"
cp "$OUT/frames/$ID/element-150.png" "$OUT/previews/$NAME.png"
