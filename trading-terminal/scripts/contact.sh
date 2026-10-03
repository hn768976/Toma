#!/usr/bin/env bash
# Five evenly spaced frames of a preview -> out/frames/<name>_sheet.png (+ single PNGs)
set -euo pipefail
cd "$(dirname "$0")/.."
N="$1"; mkdir -p out/frames
i=0
for t in 0.2 3.7 7.4 11.0 14.7; do
  ffmpeg -v error -y -ss $t -i "out/$N.mp4" -frames:v 1 "out/frames/${N}_$i.png"; i=$((i+1))
done
ffmpeg -v error -y -i out/frames/${N}_0.png -i out/frames/${N}_1.png -i out/frames/${N}_2.png -i out/frames/${N}_3.png -i out/frames/${N}_4.png -i out/frames/${N}_4.png \
  -filter_complex "[0][1]hstack[a];[2][3]hstack[b];[4][5]hstack[c];[a][b][c]vstack=inputs=3,scale=1800:-1" "out/frames/${N}_sheet.png"
