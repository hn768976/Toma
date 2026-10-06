#!/usr/bin/env bash
# Encode a rendered PNG sequence to the 720p preview mp4:
# H.264, yuv420p, CRF 16, 30 fps, no audio. `-tune grain` keeps x264 from
# quantizing away the ±1/255 dither and the grain in near-black areas (which
# would otherwise re-introduce flat plateaus in dark vignette corners).
#   scripts/encode.sh <CompositionId> <OutputName>
set -euo pipefail
ID=$1; NAME=$2; FR=out/frames/$ID
ffmpeg -v error -y -framerate 30 -i "$FR/element-%03d.png" -c:v libx264 -preset slow -tune grain -crf 16 \
  -pix_fmt yuv420p -r 30 -an -movflags +faststart "out/previews/$NAME.mp4"
cp "$FR/element-360.png" "out/previews/$NAME.png"
