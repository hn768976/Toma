#!/usr/bin/env bash
# Usage: scripts/compare.sh <CompositionId> <frame> <refId> <refSeconds> <out.png>
# Renders a 720p still and puts it next to the reference frame (ref left, ours right).
set -euo pipefail
comp=$1; frame=$2; ref=$3; t=$4; out=$5
tmp=$(mktemp -d)
npx remotion still "$comp" "$tmp/ours.png" --frame="$frame" --scale=0.3333333333333333 >/dev/null 2>&1
ffmpeg -v error -y -ss "$t" -i "refs/$ref.mp4" -frames:v 1 -vf scale=1280:720 "$tmp/ref.png"
ffmpeg -v error -y -i "$tmp/ref.png" -i "$tmp/ours.png" -filter_complex "[0][1]hstack=2" "$out"
rm -rf "$tmp"
