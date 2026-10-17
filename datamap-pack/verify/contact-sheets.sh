#!/bin/bash
# Step 5: one contact sheet per composition (frames 0, 120, 240, 360, 480 of the encoded mp4).
cd "$(dirname "$0")/.."
mkdir -p out/verify/contact
for f in out/previews/*.mp4; do
  n=$(basename "$f" .mp4)
  ffmpeg -v error -y -i "$f" -vf "select='eq(n\,0)+eq(n\,120)+eq(n\,240)+eq(n\,360)+eq(n\,480)',scale=640:360,tile=5x1" \
    -frames:v 1 -fps_mode passthrough "out/verify/contact/$n.png"
done
ls out/verify/contact
