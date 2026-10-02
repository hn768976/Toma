#!/usr/bin/env bash
# Usage: scripts/time-frames.sh <bundle> <composition> <frames e.g. 0-29> [extra remotion args]
B=$1; C=$2; F=$3; shift 3
s=$(date +%s%N)
npx remotion render "$B" "$C" "renders/_timing_$C.mp4" --scale=0.5 --frames="$F" "$@" > "renders/_timing_$C.log" 2>&1 || { tail -20 "renders/_timing_$C.log"; exit 1; }
e=$(date +%s%N)
n=$(( ${F#*-} - ${F%-*} + 1 ))
echo "$C: $n frames in $(( (e-s)/1000000 )) ms"
