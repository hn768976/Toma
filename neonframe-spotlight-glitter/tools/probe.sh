#!/bin/bash
# Step 1: basic file checks.  usage: tools/probe.sh file.mp4
f=$1
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames \
  -show_entries format=duration -of default=noprint_wrappers=1 "$f"
echo "audio streams: $(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$f" | wc -l)"
