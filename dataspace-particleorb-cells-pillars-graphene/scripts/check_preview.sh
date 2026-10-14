#!/bin/bash
# Step 1 (ffprobe), seam smoothness, contact sheet, and a frame from the
# encoded mp4 for the banding read-out.   usage: check_preview.sh FileBase
cd "$(dirname "$0")/.."
f=$1
mkdir -p out/checks
echo "== $f"
ffprobe -v error -show_entries stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt -show_entries format=duration -of default=noprint_wrappers=1 out/previews/$f.mp4 | tr '\n' ' '; echo
echo "streams: $(ffprobe -v error -show_entries stream=codec_type -of csv=p=0 out/previews/$f.mp4 | tr '\n' ' ')"
python3 scripts/seam_check.py out/frames/$f | tr '\n' ' '; echo
scripts/contact_sheet.sh out/previews/$f.mp4 out/checks/${f}_contact.png
ffmpeg -v error -y -i out/previews/$f.mp4 -vf "select=eq(n\,300)" -fps_mode passthrough -frames:v 1 out/checks/${f}_mp4_f300.png
