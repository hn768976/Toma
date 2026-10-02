#!/usr/bin/env bash
# side-by-side: scripts/sbs.sh <ref.mp4> <refTimeSec> <mine.png> <out.png>
set -e
ffmpeg -v error -y -ss "$2" -i "$1" -frames:v 1 -vf scale=640:360 /tmp/_ref.png
ffmpeg -v error -y -i "$3" -vf scale=640:360 /tmp/_mine.png
ffmpeg -v error -y -i /tmp/_ref.png -i /tmp/_mine.png -filter_complex hstack "$4"
