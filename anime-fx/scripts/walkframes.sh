#!/usr/bin/env bash
# usage: scripts/walkframes.sh <outdir> <cut> <frame>...  cropped walker frames (debug: one style held)
cd "$(dirname "$0")/.." && out=$1 cut=$2; shift 2; mkdir -p "$out"; i=0
# fixed crop window (doesn't follow her), so foot plants can be checked
cx=$(python3 -c "print(int(max(0,min(1280-640,(-0.04*3840+$1*(1.08*3840/390))/3-220))))")
for f in "$@"; do
  npx remotion still src/index.ts StyleWalk-Colours "$out/full.png" --frame="$f" --scale=0.3333333333333333 --props="{\"forceCut\":$cut}" --log=error
  ffmpeg -v error -y -i "$out/full.png" -vf "crop=640:720:$cx:0" "$out/$(printf %02d $i)_f$f.png"; i=$((i+1))
done
rm -f "$out/full.png"
ffmpeg -v error -y -pattern_type glob -i "$out/*_f*.png" -vf "tile=4x$(( (i+3)/4 )):padding=4:color=white" -frames:v 1 "$out/grid.png"
