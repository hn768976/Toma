#!/usr/bin/env bash
# Contact sheet: 5 evenly spaced frames (0, 120, 240, 360, 480) in a row.
# usage: contact.sh <video.mp4> <out.png>
set -e
ffmpeg -v error -y -i "$1" -vf "select='not(mod(n\,120))',scale=640:360,tile=5x1" -frames:v 1 -vsync vfr "$2"
