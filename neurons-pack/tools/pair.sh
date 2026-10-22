#!/usr/bin/env bash
# Render one 720p still and grab the reference frame at the same story point.
# usage: tools/pair.sh <compositionId> <frame> <refId> <refSeconds> <outDir>
set -euo pipefail
cd "$(dirname "$0")/.."
comp=$1; frame=$2; ref=$3; sec=$4; out=$5
mkdir -p "$out"
npx remotion still "$comp" "$out/${comp}_f${frame}.png" --frame="$frame" --scale=0.3333333333333333 --log=error
if [ "$ref" != "-" ]; then
  ffmpeg -v error -y -ss "$sec" -i "refs/$ref.mp4" -frames:v 1 -vf scale=1280:720:flags=lanczos "$out/ref_${ref}_${sec}s.png"
fi
