#!/usr/bin/env bash
# Render frames of a composition and put them next to the same moments of the reference clip.
# usage: scripts/compare.sh <reference.mp4> <CompositionId> <outdir> <time_s> [<time_s> ...]
set -euo pipefail
REF="$1"; COMP="$2"; OUT="$3"; shift 3
mkdir -p "$OUT"
for T in "$@"; do
  F=$(python3 -c "print(round($T*30))")
  ffmpeg -v error -y -ss "$T" -i "$REF" -frames:v 1 "$OUT/ref-$T.png"
  npx remotion still "$COMP" "$OUT/ours-$T.png" --frame="$F" --scale=0.5 --gl=angle --log=error >/dev/null
  python3 "$(dirname "$0")/measure-look.py" "$OUT/ref-$T.png" "$OUT/ours-$T.png" --side-by-side "$OUT/compare-$T.png" --json "$OUT/measure-$T.json" ${MEASURE_ARGS:-} --quiet
done
