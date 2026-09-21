#!/bin/sh
set -e
cd "$(dirname "$0")/.."
S=$(date +%s)
npx remotion render DuotoneGlass-PodiumMagentaCyan out/preview/DuotoneGlass_PodiumMagentaCyan.mp4 --scale=0.5 --crf=16
E=$(date +%s)
echo "TIMING DuotoneGlass-PodiumMagentaCyan video $((E-S))s total, $(echo "scale=3;($E-$S)/300"|bc)s/frame"
npx remotion still DuotoneGlass-PodiumMagentaCyan out/stills/DuotoneGlass_PodiumMagentaCyan.png --frame=42 --scale=0.5
echo "DONE DuotoneGlass_PodiumMagentaCyan"
echo LOOK1_DONE
