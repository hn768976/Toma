#!/bin/bash
# scripts/encode.sh <name>: out/frames/<name>/f%03d.png -> out/previews/<name>.mp4 (1280x720 H.264 CRF 16)
n=$1
ffmpeg -v error -y -framerate 30 -start_number 0 -i out/frames/$n/f%03d.png \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -crf 16 -preset slow -tune grain -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -r 30 -an -movflags +faststart out/previews/$n.mp4
