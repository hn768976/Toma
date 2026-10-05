#!/usr/bin/env bash
# usage: scripts/sbs.sh <refId> <refSeconds> <ours.png> <out.png>  side-by-side (ref | ours) at 768x432
set -euo pipefail
ffmpeg -v error -y -ss "$2" -i "refs/$1.mp4" -i "$3" -filter_complex "[0:v]scale=768:432,setsar=1[a];[1:v]scale=768:432:flags=lanczos,setsar=1[b];[a][b]hstack" -frames:v 1 "$4"
