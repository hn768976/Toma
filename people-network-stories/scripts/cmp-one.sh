#!/bin/bash
# usage: cmp-one.sh <PreviewName> <refId> <seconds> <length> <outA> <outB>
cd "$(dirname "$0")/.."
rlen=$(ffprobe -v error -show_entries format=duration -of csv=p=0 refs/$2.mp4)
rt=$(echo "scale=3; $3 * $rlen / $4" | bc)
ffmpeg -v error -y -ss $rt -i refs/$2.mp4 -frames:v 1 "$5"
ffmpeg -v error -y -ss $3 -i out/previews/$1.mp4 -frames:v 1 -vf scale=596:336:flags=lanczos "$6"
