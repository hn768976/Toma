#!/usr/bin/env bash
# usage: scripts/compare.sh <refId> <refSeconds> <minePng> <out>
# Writes the reference frame (scaled to 1280x720) and a stacked ref/mine sheet.
set -e
cd "$(dirname "$0")/.."
ffmpeg -v error -y -ss "$2" -i "refs/$1.mp4" -frames:v 1 -vf "scale=1280:720:flags=lanczos" "$4_ref.png"
ffmpeg -v error -y -i "$4_ref.png" -i "$3" -filter_complex "[0]scale=640:360[a];[1]scale=640:360[b];[a][b]vstack" "$4_sheet.png"
