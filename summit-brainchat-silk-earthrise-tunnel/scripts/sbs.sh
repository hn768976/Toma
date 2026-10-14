#!/usr/bin/env bash
# side-by-side: reference frame (left) vs ours (right), both 960x540
# scripts/sbs.sh <ref.mp4> <ref_time_s> <ours.png> <out.png>
set -e
ffmpeg -v error -y -ss "$2" -i "$1" -frames:v 1 -vf scale=960:540 /tmp/_ref.png
ffmpeg -v error -y -i /tmp/_ref.png -i "$3" -filter_complex "[1]scale=960:540[b];[0][b]hstack" "$4"
