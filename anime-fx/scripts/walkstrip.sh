#!/usr/bin/env bash
# usage: scripts/walkstrip.sh <out.png> <frame>...   crops around the walker
cd "$(dirname "$0")/.." && out=$1; shift; tmp=$(mktemp -d); i=0
for f in "$@"; do
  scripts/still.sh StyleWalk-Colours "$f" "$tmp/full.png" >/dev/null 2>&1
  cx=$(python3 -c "print(int(max(0,min(1280-360,(-0.04*3840+$f*(1.08*3840/390))/3-180))))")
  ffmpeg -v error -y -i "$tmp/full.png" -vf "crop=360:720:$cx:0" "$tmp/$(printf %03d $i).png"; i=$((i+1))
done
ffmpeg -v error -y -i "$tmp/%03d.png" -vf "tile=${i}x1:padding=4" -frames:v 1 "$out"; rm -r "$tmp"
