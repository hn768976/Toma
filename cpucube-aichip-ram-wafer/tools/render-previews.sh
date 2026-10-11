#!/bin/bash
# 720p previews: a full Remotion render of all 600 frames as a PNG sequence
# (out of order across 2 browser tabs), then H.264 / yuv420p / 30fps / CRF 16.
# The PNG sequence is kept in renders/frames/<id>/ for the determinism check.
# Usage: bash tools/render-previews.sh [CompId ...]
cd "$(dirname "$0")/.."
mkdir -p renders/frames
IDS=${@:-$(cat tools/all.txt)}
for id in $IDS; do
  name=${id/-/_}
  rm -rf "renders/frames/$id"
  start=$(date +%s)
  npx remotion render src/index.ts "$id" "renders/frames/$id" --sequence --image-format=png \
    --scale=0.3333333333333333 --concurrency=2 --log=error
  mid=$(date +%s)
  ffmpeg -v error -y -framerate 30 -i "renders/frames/$id/element-%03d.png" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -movflags +faststart "renders/$name.mp4"
  end=$(date +%s)
  echo "$id render=$((mid-start))s encode=$((end-mid))s" | tee -a renders/timings.txt
done
