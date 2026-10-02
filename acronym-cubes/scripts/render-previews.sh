#!/usr/bin/env bash
# Renders 1080p previews plus determinism evidence, timing each step.
#   bash scripts/render-previews.sh            # ETF and 401K
#   bash scripts/render-previews.sh 401K       # just one
# Writes out/final/Cubes_<A>.mp4, out/seq_<A>/ (full out-of-order PNG render)
# and out/cold_<A>_100.png (frame 100 rendered alone from a cold start).
set -euo pipefail
cd "$(dirname "$0")/.."
LIST=("$@"); [ ${#LIST[@]} -eq 0 ] && LIST=(ETF 401K)
mkdir -p out/final
npx remotion bundle --out-dir build >/dev/null
t() { local s=$(date +%s.%N); "$@"; local e=$(date +%s.%N); echo "TIME $(echo "$e - $s" | bc) s :: $*" | tee -a out/timings.log; }
for A in "${LIST[@]}"; do
  t npx remotion render build Cubes-$A out/final/Cubes_$A.mp4 --scale=0.5 --concurrency=1
done
for A in "${LIST[@]}"; do
  rm -rf out/seq_$A
  t npx remotion render build Cubes-$A out/seq_$A --sequence --image-format=png --scale=0.5 --concurrency=2
  t npx remotion still build Cubes-$A out/cold_${A}_100.png --frame=100 --scale=0.5 --image-format=png
done
