#!/usr/bin/env bash
# Usage: tools/sheet.sh <bundleDir> <compositionId> <outPng> <frame> [frame...]
# Renders 720p stills of the given frames and tiles them in a row.
set -euo pipefail
B=$1; C=$2; O=$3; shift 3
T=$(mktemp -d)
i=0; inputs=()
for f in "$@"; do
  npx remotion still "$B" "$C" "$T/$i.png" --frame="$f" --scale=0.3333333333333333 --log=error >/dev/null
  inputs+=(-i "$T/$i.png"); i=$((i+1))
done
ffmpeg -v error -y "${inputs[@]}" -filter_complex "hstack=inputs=$i,scale=iw/2:-1" "$O"
rm -rf "$T"
