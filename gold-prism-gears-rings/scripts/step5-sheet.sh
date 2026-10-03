#!/usr/bin/env bash
# Five evenly spaced frames (0,120,240,360,480) from an encoded preview, in a row.
set -euo pipefail
N=$1; mkdir -p out/check/s5
ffmpeg -v error -y -i out/previews/$N.mp4 \
  -vf "select='not(mod(n\,120))',format=rgb24,scale=256:144:flags=lanczos,tile=5x1" \
  -fps_mode passthrough -frames:v 1 -pix_fmt rgb24 out/check/s5/$N.png
