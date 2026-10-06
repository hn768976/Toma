#!/usr/bin/env bash
# ffprobe check + five-frame contact sheet + 720p PNG still from the encoded mp4.
# usage: scripts/verify.sh <name> (expects renders/<name>.mp4)
set -euo pipefail
N=$1; F=renders/$N.mp4
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt \
  -show_entries format=duration -of default=noprint_wrappers=1 "$F"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$F")
mkdir -p renders/sheets renders/stills
# five evenly spaced frames in a row
ffmpeg -v error -y -i "$F" -vf "fps=5/$D,scale=512:-1,tile=5x1" -frames:v 1 "renders/sheets/${N}_sheet.png"
