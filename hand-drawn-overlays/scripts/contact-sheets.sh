#!/usr/bin/env bash
# 7 Contact sheets: 6 frames per clip (3x2), labelled with the frame number.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/contact
declare -A F=([DoodlePack_WhiteOnBlack]="20 80 150 250 315 345" [DoodlePack_InkOnGreen]="20 80 150 250 315 345" \
  [ScribbleWipe_Marker]="8 20 36 47 62 80" [ScribbleWipe_Ink]="8 20 36 47 62 80" \
  [Handwritten_Hello]="10 40 75 105 125 170" [Handwritten_ThankYou]="10 40 75 105 125 170" \
  [Handwritten_Welcome]="10 40 75 105 125 170" [Handwritten_Subscribe]="10 40 75 105 125 170" \
  [NotebookPage_Loop]="0 120 300 450 540 599" [InkFlourish_Black]="20 45 70 100 116 145")
for name in "${!F[@]}"; do
  tiles=()
  for f in ${F[$name]}; do
    ffmpeg -v error -y -i "out/previews/$name.mp4" -vf "select='eq(n\,$f)'" -vsync 0 -frames:v 1 "out/contact/${name}_$f.png"
    tiles+=(-label "frame $f" "out/contact/${name}_$f.png")
  done
  montage "${tiles[@]}" -tile 3x2 -geometry 640x360+6+6 -pointsize 18 -background '#777' "out/contact/$name.png"
  rm out/contact/${name}_*.png
done
ls out/contact
