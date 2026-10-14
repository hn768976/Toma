#!/usr/bin/env bash
# Render one composition's 720p preview.
#   scripts/render-preview.sh <CompositionId> <OutputBaseName>
# 1) Remotion renders the full 600-frame PNG sequence at --scale=1/3
#    (1280x720), using the bundle in build/bundle.
# 2) ffmpeg encodes it: H.264, yuv420p, 30 fps, CRF 16, no audio.
# The PNG of frame 300 (and a few others) is kept for the determinism check.
set -euo pipefail
ID="$1"; NAME="$2"
OUT=renders; SEQ="$OUT/seq/$NAME"
mkdir -p "$OUT" "$SEQ" "$OUT/keep"
start=$(date +%s.%N)
npx remotion render build/bundle "$ID" "$SEQ" --sequence --image-format=png \
  --scale=0.3333333333333333 --concurrency=1 --log=error
end=$(date +%s.%N)
echo "$ID render_seconds=$(echo "$end - $start" | bc)" | tee -a "$OUT/render-times.txt"
first=$(ls "$SEQ" | head -1)
pattern=$(echo "$first" | sed -E 's/[0-9]+\.png$//')
digits=$(echo "$first" | sed -E 's/.*[^0-9]([0-9]+)\.png$/\1/' | tr -d '\n' | wc -c)
ffmpeg -v error -y -framerate 30 -i "$SEQ/${pattern}%0${digits}d.png" -c:v libx264 -crf 16 \
  -pix_fmt yuv420p -preset slow -movflags +faststart -an "$OUT/$NAME.mp4"
for f in 0 150 299 300 301 450 599; do
  cp "$SEQ/${pattern}$(printf "%0${digits}d" $f).png" "$OUT/keep/${NAME}_f$(printf %03d $f).png"
done
cp "$OUT/keep/${NAME}_f300.png" "$OUT/${NAME}.png"
rm -rf "$SEQ"
echo "done $NAME"
