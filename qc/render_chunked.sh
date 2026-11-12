#!/bin/bash
# Resumable chunked render: renders <comp> in N frame-range chunks (skipping chunks
# already present), then joins them losslessly (stream copy) into <out.mp4>.
# Usage: render_chunked.sh <project-dir> <composition> <total-frames> <chunks> <out.mp4> [extra remotion args...]
set -euo pipefail
PROJ=$1; COMP=$2; TOTAL=$3; N=$4; OUT=$5; shift 5
WORK="$(dirname "$OUT")/.chunks_${COMP}"
mkdir -p "$WORK"
cd "$PROJ"
: > "$WORK/list.txt"
for ((i = 0; i < N; i++)); do
  a=$(( i * TOTAL / N )); b=$(( (i + 1) * TOTAL / N - 1 ))
  part="$WORK/part_$(printf %02d $i).mp4"
  echo "file '$part'" >> "$WORK/list.txt"
  if [ -s "$part.done" ]; then echo "chunk $i ($a-$b) already done"; continue; fi
  echo "rendering chunk $i: frames $a-$b"
  npx remotion render "$COMP" "$part" --frames=$a-$b "$@"
  echo ok > "$part.done"
done
ffmpeg -v error -y -f concat -safe 0 -i "$WORK/list.txt" -c copy -movflags +faststart "$OUT"
rm -rf "$WORK"
echo "wrote $OUT"
