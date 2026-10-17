#!/bin/bash
# Step 1: basic file checks for every preview.
for f in out/previews/*.mp4; do
  echo "== $f"
  ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
    -show_entries format=duration -of default=noprint_wrappers=1 "$f"
done
