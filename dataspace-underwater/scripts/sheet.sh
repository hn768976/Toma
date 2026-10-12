#!/usr/bin/env bash
# usage: scripts/sheet.sh <dir> <out.png>  — tiles all PNGs in dir into one row
set -e
files=( "$1"/*.png ); n=${#files[@]}
args=(); for f in "${files[@]}"; do args+=(-i "$f"); done
ffmpeg -v error -y "${args[@]}" -filter_complex "$(for i in $(seq 0 $((n-1))); do printf "[%d:v]scale=640:360[v%d];" $i $i; done)$(for i in $(seq 0 $((n-1))); do printf "[v%d]" $i; done)hstack=inputs=$n" "$2"
