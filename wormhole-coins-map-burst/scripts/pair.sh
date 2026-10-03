#!/usr/bin/env bash
# Usage: scripts/pair.sh <CompositionId> <frame> <refId> <refSeconds> <outPrefix>
# Writes <outPrefix>_ref.png (reference) and <outPrefix>_ours.png (frame from a 720p H.264 encode).
set -euo pipefail
comp=$1; frame=$2; ref=$3; t=$4; out=$5
tmp=$(mktemp -d)
npx remotion render "$comp" "$tmp/o.mp4" --frames="$frame-$frame" --scale=0.3333333333333333 --crf=16 --pixel-format=yuv420p --image-format=png --muted >/dev/null 2>&1
ffmpeg -v error -y -i "$tmp/o.mp4" -frames:v 1 "${out}_ours.png"
ffmpeg -v error -y -ss "$t" -i "refs/$ref.mp4" -frames:v 1 -vf scale=1280:720 "${out}_ref.png"
rm -rf "$tmp"
