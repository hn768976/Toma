#!/usr/bin/env bash
# side-by-side: sbs.sh <ref.mp4> <ref_time_s> <mine.png> <out.png>
ffmpeg -v error -y -ss "$2" -i "$1" -i "$3" -filter_complex "[0:v]scale=960:540,setsar=1[a];[1:v]scale=960:540,setsar=1[b];[a][b]hstack" -frames:v 1 "$4"
