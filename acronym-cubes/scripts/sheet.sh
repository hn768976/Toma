#!/usr/bin/env bash
# Dev helper: contact sheet of 5 stills of one composition at 720p.
# scripts/sheet.sh <compositionId> <outPrefix>
set -e
id=$1; pre=$2
for f in 0 120 240 360 480; do
  npx remotion still out/bundle "$id" "${pre}_$f.png" --frame=$f --scale=0.3333333333333333 >/dev/null 2>&1
done
ffmpeg -v error -y -i ${pre}_0.png -i ${pre}_120.png -i ${pre}_240.png -i ${pre}_360.png -i ${pre}_480.png \
  -filter_complex "[0][1][2][3][4]hstack=5,scale=3200:-1" ${pre}_sheet.png
