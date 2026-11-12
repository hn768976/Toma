#!/usr/bin/env bash
# usage: scripts/sheet.sh <CompId> <out.png> <frame> [frame...]  -> 2-col contact sheet
cd "$(dirname "$0")/.." && id=$1 out=$2; shift 2; tmp=$(mktemp -d); i=0
for f in "$@"; do scripts/still.sh "$id" "$f" "$tmp/$(printf %03d $i).png" >/dev/null 2>&1; i=$((i+1)); done
n=$i; cols=2; rows=$(( (n+1)/2 ))
ffmpeg -v error -y -i "$tmp/%03d.png" -vf "scale=960:-1,tile=${cols}x${rows}:padding=6" -frames:v 1 "$out"; rm -r "$tmp"
