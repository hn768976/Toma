#!/usr/bin/env bash
# Usage: scripts/compare.sh <CompositionId> <refId> <frame> <refSeconds> <out.png>
# Renders one 720p still and stacks it under a frame of the reference clip (both 960 wide).
set -e
cd "$(dirname "$0")/.."
mkdir -p out/cmp
npx remotion still "$1" "out/cmp/$1_$3.png" --frame="$3" --scale=0.3333333333333333 >/dev/null 2>&1 || { echo "render failed"; exit 1; }
ffmpeg -v error -y -ss "$4" -i "refs/$2.mp4" -i "out/cmp/$1_$3.png" -filter_complex "[0]scale=960:540[a];[1]scale=960:540[b];[a][b]vstack" -frames:v 1 "$5"
