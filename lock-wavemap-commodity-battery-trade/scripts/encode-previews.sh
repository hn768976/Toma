#!/usr/bin/env bash
# (Re-)encode the 720p previews from the PNG sequences in out/frames/ without
# re-rendering: H.264, yuv420p, CRF 16, -tune grain (keeps the dither), 30 fps.
set -euo pipefail
cd "$(dirname "$0")/.."
for dir in out/frames/*/; do
  id=$(basename "$dir"); name=${id/-/_}
  n=600; case $id in TradeChart-*) n=450;; esac
  ffmpeg -v error -y -framerate 30 -start_number 0 -i "$dir/element-%03d.png" -frames:v $n \
    -c:v libx264 -crf 16 -tune grain -pix_fmt yuv420p -r 30 -an -movflags +faststart "out/previews/$name.mp4"
  echo "encoded out/previews/$name.mp4"
done
