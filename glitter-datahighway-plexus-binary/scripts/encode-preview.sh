#!/usr/bin/env bash
# Encode a rendered 1280x720 PNG sequence (frames 0..599) to the delivered
# preview: H.264, yuv420p, CRF 16, 30 fps, no audio.
# aq-mode=3 (dark-biased adaptive quantisation) keeps the ±1/255 dither and
# grain in dark gradients; with the default AQ x264 flattens them into
# 8x8 blocks, which is where banding would come back.
#   scripts/encode-preview.sh <png-seq-dir> <out.mp4>
set -euo pipefail
ffmpeg -v error -y -framerate 30 -start_number 0 -i "$1/element-%03d.png" -frames:v 600 \
  -c:v libx264 -pix_fmt yuv420p -crf 16 -preset slow -x264-params aq-mode=3:aq-strength=1.2 \
  -r 30 -an -movflags +faststart "$2"
