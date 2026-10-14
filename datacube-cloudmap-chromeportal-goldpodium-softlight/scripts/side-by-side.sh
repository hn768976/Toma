#!/usr/bin/env bash
# side-by-side.sh <refId> <refSeconds> <ourPng> <out>
set -e
ffmpeg -v error -y -ss "$2" -i "refs/$1.mp4" -frames:v 1 -vf scale=640:360 /tmp/_ref.png
ffmpeg -v error -y -i "$3" -vf scale=640:360 /tmp/_ours.png
ffmpeg -v error -y -i /tmp/_ref.png -i /tmp/_ours.png -filter_complex hstack "$4"
