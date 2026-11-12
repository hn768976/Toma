#!/bin/bash
# Normalise Remotion output (full-range yuvj420p) to broadcast-standard limited-range yuv420p,
# BT.709 tagged, H.264 High, faststart. Visually lossless (CRF 14, slow).
set -e
in="$1"; out="$2"
ffmpeg -v error -y -i "$in" -vf "scale=in_range=pc:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 14 -profile:v high -level 4.2 -r 30 \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -movflags +faststart -an "$out"
