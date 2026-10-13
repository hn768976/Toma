#!/usr/bin/env bash
# scripts/side-by-side.sh <ref.mp4> <refSeconds> <ours.png> <out.png>
set -euo pipefail
ffmpeg -v error -y -ss "$2" -i "$1" -frames:v 1 -vf scale=1280:720 /tmp/_ref_sbs.png
ffmpeg -v error -y -i /tmp/_ref_sbs.png -i "$3" -filter_complex "[0][1]vstack=2,scale=960:-1" "$4"
