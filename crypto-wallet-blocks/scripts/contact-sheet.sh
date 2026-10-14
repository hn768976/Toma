#!/bin/bash
# Contact sheet from an encoded mp4: evenly spaced frames, with frame numbers.
# usage: scripts/contact-sheet.sh <file.mp4> <out.png> <frame> [<frame> ...]
set -e
src=$1; out=$2; shift 2
tmp=$(mktemp -d)
i=0
for f in "$@"; do
  ffmpeg -v error -y -i "$src" -vf "select=eq(n\,$f),scale=640:360,drawtext=text='f$f':x=12:y=12:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.5" -frames:v 1 "$tmp/$(printf %02d $i).png"
  i=$((i+1))
done
cols=4; [ "$#" -le 5 ] && cols=$#
ffmpeg -v error -y -pattern_type glob -i "$tmp/*.png" -vf "tile=${cols}x$(( ($# + cols - 1) / cols ))" -frames:v 1 "$out"
rm -rf "$tmp"
