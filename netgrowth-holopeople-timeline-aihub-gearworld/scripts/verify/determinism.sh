#!/usr/bin/env bash
# Step 3: full multi-threaded PNG-sequence render vs. a cold-start still of the middle frame.
set -uo pipefail
cd "$(dirname "$0")/../.."
. scripts/comps.sh
mkdir -p out/verify/det
for row in $COMPS; do
  IFS=: read -r id file frames kind <<<"$row"
  if [ $# -gt 0 ] && [[ " $* " != *" $id "* ]]; then continue; fi
  mid=$((frames / 2))
  rm -rf out/verify/det/seq && mkdir -p out/verify/det/seq
  npx remotion render out/bundle "$id" out/verify/det/seq --sequence --image-format=png --scale=0.3333333333333333 --gl=angle --concurrency=4 --timeout=240000 >/dev/null 2>&1
  full=$(ls out/verify/det/seq/*.png | sort | sed -n "$((mid + 1))p")
  cp "$full" "out/verify/det/$id-full-$mid.png"
  rm -rf out/verify/det/seq
  npx remotion still out/bundle "$id" "out/verify/det/$id-cold-$mid.png" --frame=$mid --scale=0.3333333333333333 --gl=angle --timeout=240000 >/dev/null 2>&1
  echo -n "$id frame $mid ($(basename "$full")): "
  python3 scripts/verify/compare_png.py "out/verify/det/$id-full-$mid.png" "out/verify/det/$id-cold-$mid.png"
done
