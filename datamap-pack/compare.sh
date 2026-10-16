#!/bin/sh
# usage: ./compare.sh <ref.mp4> <ref_time_s> <mine.png> <out.png>
S=$(mktemp -d)
ffmpeg -v error -y -ss "$2" -i "$1" -frames:v 1 -vf scale=640:360 "$S/a.png"
ffmpeg -v error -y -i "$3" -vf scale=640:360 "$S/b.png"
ffmpeg -v error -y -i "$S/a.png" -i "$S/b.png" -filter_complex vstack "$4"
rm -rf "$S"
