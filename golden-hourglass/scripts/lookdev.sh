#!/usr/bin/env bash
# Look development: render the 3 LookDev stills, measure them against the reference and
# write lookdev/compare-<moment>.png (reference | ours | difference) + lookdev/measure-<moment>.txt
# usage: scripts/lookdev.sh <reference.mp4>
set -euo pipefail
REF="$1"; cd "$(dirname "$0")/.."
NAMES=(start peak late); TIMES=(0.5 9.0 13.0)
mkdir -p lookdev out/lookdev
for i in 0 1 2; do
  n=${NAMES[$i]}; t=${TIMES[$i]}
  ffmpeg -v error -y -ss "$t" -i "$REF" -frames:v 1 "out/lookdev/ref-$n.png"
  npx remotion still LookDev "out/lookdev/ours-$n.png" --frame="$i" --scale=0.5 --gl=angle --log=error >/dev/null
  python3 scripts/measure-look.py --crop-aspect 1.8987 "out/lookdev/ref-$n.png" "out/lookdev/ours-$n.png" \
    --side-by-side "lookdev/compare-$n.png" --json "lookdev/measure-$n.json" ${MEASURE_ARGS:-} > "lookdev/measure-$n.txt"
  tail -1 "lookdev/measure-$n.txt"
done
