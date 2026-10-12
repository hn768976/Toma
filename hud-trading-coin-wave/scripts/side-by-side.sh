#!/usr/bin/env bash
# side-by-side.sh <comp-id> <ref-id> <out.png> [frame] [ref-seconds]
# Reference frame (left) next to our 720p still (right), both at 960×540.
set -euo pipefail
cd "$(dirname "$0")/.."
id=$1; ref=$2; out=$3; frame=${4:-150}; rs=${5:-5}
tmp=$(mktemp -d)
npx remotion still build "$id" "$tmp/ours.png" --frame="$frame" --scale=0.3333333333333333 --gl=angle >/dev/null 2>&1
ffmpeg -v error -y -ss "$rs" -i "refs/$ref.mp4" -frames:v 1 "$tmp/ref.png"
ffmpeg -v error -y -i "$tmp/ref.png" -i "$tmp/ours.png" -filter_complex \
  "[0]scale=960:540:flags=lanczos[a];[1]scale=960:540:flags=lanczos[b];[a][b]hstack" "$out"
rm -rf "$tmp"
