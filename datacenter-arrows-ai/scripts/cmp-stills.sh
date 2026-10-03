#!/usr/bin/env bash
# Usage: scripts/cmp-stills.sh <outdir> <compId> <frame> <refId> <refSeconds> <name>
# Renders one 720p still of a composition and extracts the matching reference
# frame (scaled to 1280x720) for side-by-side comparison.
set -euo pipefail
out=$1; comp=$2; frame=$3; ref=$4; t=$5; name=$6
mkdir -p "$out"
npx remotion still "$comp" "$out/${name}_mine.png" --frame="$frame" --scale=0.3333333333333333 --log=error
ffmpeg -v error -y -ss "$t" -i "refs/$ref.mp4" -frames:v 1 -vf "scale=1280:720:flags=lanczos" "$out/${name}_ref.png"
ffmpeg -v error -y -i "$out/${name}_ref.png" -i "$out/${name}_mine.png" -filter_complex "[0][1]hstack" "$out/${name}_side.png"
