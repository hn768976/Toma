#!/bin/bash
# Five-frame contact sheet (frames 0, 120, 240, 360, 480) taken from the encoded mp4.
N="$1"; cd "$(dirname "$0")/.."
ffmpeg -v error -y -i "renders/$N.mp4" -vf "select='not(mod(n\,120))',scale=512:288,tile=5x1" -frames:v 1 "renders/sheets/$N.png"
