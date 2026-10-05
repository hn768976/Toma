#!/usr/bin/env bash
# Step 1: ffprobe basics.
set -euo pipefail
for f in "$@"; do
  echo "== $f"
  ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
    -show_entries format=duration -of default=noprint_wrappers=1 "$f"
  echo "frames: $(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$f")"
done
