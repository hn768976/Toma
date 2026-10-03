#!/usr/bin/env bash
# Step 1: basic file checks on the rendered previews.
set -euo pipefail
cd "$(dirname "$0")/.."
for f in out/*.mp4; do
  echo "== $f"
  ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
    -show_entries format=duration -of default=noprint_wrappers=1 "$f"
  echo "audio streams: $(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$f" | wc -l)"
done
