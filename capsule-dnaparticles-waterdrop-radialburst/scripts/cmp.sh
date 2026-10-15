#!/usr/bin/env bash
# side-by-side: mine (left) vs reference (right), both 640x360
ffmpeg -v error -y -i "$1" -i "$2" -filter_complex "[0]scale=640:360[a];[1]scale=640:360[b];[a][b]hstack" "$3"
