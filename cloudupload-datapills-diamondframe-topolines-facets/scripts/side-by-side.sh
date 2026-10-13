#!/usr/bin/env bash
# side-by-side.sh <refID> <refTimeSec> <mine.png> <out.png>
set -e
ffmpeg -v error -y -ss "$2" -i "refs/$1.mp4" -frames:v 1 -vf scale=1280:720 /tmp/_ref.png
ffmpeg -v error -y -i /tmp/_ref.png -i "$3" -filter_complex "[0][1]vstack" "$4"
