#!/usr/bin/env bash
# Render one composition as a 720p preview: PNG sequence at --scale=1/3
# (exact 1280x720 frames), then H.264 / yuv420p / CRF 16 / 30 fps with ffmpeg.
# Keeping the PNG frames lets the verify step compare them byte for byte.
# Usage: scripts/render-preview.sh <CompositionId> <OutputName>
set -euo pipefail
ID="$1"
NAME="$2"
OUT="${OUT:-out/previews}"
SEQ="out/seq/$NAME"
mkdir -p "$OUT" "$SEQ"
START=$(date +%s.%N)
if [ "${SKIP_RENDER:-0}" != "1" ]; then
npx remotion render "$ID" "$SEQ" </dev/null --sequence --image-format=png \
  --scale=0.3333333333333333 --concurrency=1 --log=error
END=$(date +%s.%N)
N=$(ls "$SEQ"/*.png | wc -l)
echo "$NAME frames=$N seconds=$(echo "$END - $START" | bc)" | tee -a out/render-times.txt
fi
N=$(ls "$SEQ"/*.png | wc -l)
ffmpeg -nostdin -v error -y -framerate 30 -i "$SEQ/element-%03d.png" \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p \
  -vf "scale=out_color_matrix=bt709:out_range=tv" \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -r 30 -an -movflags +faststart "$OUT/$NAME.mp4"
# 720p still: the middle frame.
MID=$(printf "%03d" $((N / 2)))
cp "$SEQ/element-$MID.png" "$OUT/$NAME.png"
