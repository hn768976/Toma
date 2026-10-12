#!/usr/bin/env bash
# Render a 720p preview of one composition:
#   1. Remotion renders the PNG frame sequence (multi-threaded, out of order),
#   2. ffmpeg encodes H.264 yuv420p CRF 16, 30 fps, no audio.
# Keeps frames 285–315 (motion check) and frame 300 (determinism check).
# usage: scripts/render-preview.sh <compId> <OutName> [bundleDir]
set -euo pipefail
cd "$(dirname "$0")/.."
ID=$1; NAME=$2; BUNDLE=${3:-out/bundle}
SEQ=out/seq/$ID
rm -rf "$SEQ"; mkdir -p out/previews out/keep/$ID
T0=$(date +%s.%N)
npx remotion render "$BUNDLE" "$ID" "$SEQ" --sequence --image-format=png \
  --scale=0.3333333333333333 --concurrency=4 --gl=angle --log=warn
T1=$(date +%s.%N)
FIRST=$(ls "$SEQ" | sed -n 1p); PATTERN=$(echo "$FIRST" | sed -E 's/[0-9]+\.png$//')
DIGITS=$(echo "$FIRST" | sed -E 's/.*[^0-9]([0-9]+)\.png$/\1/' | tr -d '\n' | wc -c)
ffmpeg -v error -y -framerate 30 -i "$SEQ/${PATTERN}%0${DIGITS}d.png" -c:v libx264 -preset slow -crf 16 \
  -pix_fmt yuv420p -r 30 -an -movflags +faststart "out/previews/$NAME.mp4"
for f in $(seq 285 315); do cp "$SEQ/$(printf "${PATTERN}%0${DIGITS}d.png" $f)" out/keep/$ID/; done
N=$(ls "$SEQ" | wc -l)
echo "$ID frames=$N render_s=$(echo "$T1 - $T0" | bc) per_frame_wall_s=$(echo "($T1 - $T0)/$N" | bc -l | cut -c1-6)" | tee -a out/render-times.txt
rm -rf "$SEQ"
