#!/usr/bin/env bash
# Step 5: one contact sheet per preview, five evenly spaced frames in a row.
cd "$(dirname "$0")/.."
mkdir -p out/contact
for f in renders/*.mp4; do
  n=$(basename "$f" .mp4)
  ffmpeg -v error -y -i "$f" -vf "select='not(mod(n\,120))',scale=512:288,tile=5x1" -frames:v 1 "out/contact/$n.png"
done
