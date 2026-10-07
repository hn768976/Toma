#!/usr/bin/env bash
# Contact sheet: tile PNGs in a row. Usage: scripts/sheet.sh out.png a.png b.png ...
out="$1"; shift
n=$#
inputs=(); for f in "$@"; do inputs+=(-i "$f"); done
ffmpeg -v error -y "${inputs[@]}" -filter_complex "$(for i in $(seq 0 $((n-1))); do printf '[%d:v]scale=640:360[s%d];' $i $i; done)$(for i in $(seq 0 $((n-1))); do printf '[s%d]' $i; done)hstack=inputs=$n" "$out"
