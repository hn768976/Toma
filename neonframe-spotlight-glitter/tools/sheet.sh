#!/bin/bash
# usage: sheet.sh <out.png> <tile-width> <img1> <img2> ...  -> one row contact sheet
out=$1; w=$2; shift 2
n=$#; args=(); i=0
for f in "$@"; do args+=(-i "$f"); done
ffmpeg -v error -y "${args[@]}" -filter_complex "$(for ((k=0;k<n;k++)); do printf "[%d:v]scale=%d:-1[s%d];" $k $w $k; done)$(for ((k=0;k<n;k++)); do printf "[s%d]" $k; done)hstack=inputs=$n" "$out"
