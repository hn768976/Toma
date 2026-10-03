#!/usr/bin/env bash
# Seam test for the looping compositions: makes the loop 601 frames long via
# the loopCheck prop, renders frames 0 and 600 and compares decoded pixels.
# Usage: scripts/loop-check.sh <outdir> <compId> [<compId> ...]
set -euo pipefail
out=$1; shift
mkdir -p "$out"
for comp in "$@"; do
  for f in 0 600; do
    npx remotion still "$comp" "$out/${comp}_f$f.png" --frame=$f --scale=0.3333333333333333 \
      --props='{"loopCheck":true}' --log=error
  done
  a=$(ffmpeg -v error -i "$out/${comp}_f0.png" -f rawvideo -pix_fmt rgb24 - | md5sum | cut -d' ' -f1)
  b=$(ffmpeg -v error -i "$out/${comp}_f600.png" -f rawvideo -pix_fmt rgb24 - | md5sum | cut -d' ' -f1)
  if [ "$a" = "$b" ]; then echo "PASS $comp frame0==frame600 ($a)"; else echo "FAIL $comp ($a vs $b)"; fi
done
