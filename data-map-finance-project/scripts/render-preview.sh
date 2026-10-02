#!/usr/bin/env bash
# 1080p preview of one composition: lossless PNG frames, then H.264 CRF 16.
# Keeping the PNG frames lets the determinism check compare frame 150 of the
# full render with a cold-start still, byte for byte.
# The x264 params keep empty black areas at 0 (no chroma drift / ringing in
# flat black); still H.264, CRF 16, yuv420p.
#   usage: scripts/render-preview.sh <composition-id> <output-name> [concurrency]
set -euo pipefail
cd "$(dirname "$0")/.."
ID=$1; NAME=$2; CONC=${3:-2}
mkdir -p out/frames/"$NAME" out/previews
npx remotion render "$ID" out/frames/"$NAME" --sequence --image-format=png \
  --scale=0.5 --gl=angle --concurrency="$CONC" --log=error
ffmpeg -v error -y -framerate 30 -i out/frames/"$NAME"/element-%03d.png \
  -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -r 30 -an \
  -x264-params "chroma-qp-offset=-12:no-fast-pskip=1:no-dct-decimate=1:trellis=2" \
  -movflags +faststart out/previews/"$NAME".mp4
