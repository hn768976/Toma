#!/usr/bin/env bash
# Renders the 8 x 1280x720 previews + one 720p PNG still each into out/previews.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/comps.sh
mkdir -p out/previews
npx remotion bundle src/index.ts --out-dir=out/bundle >/dev/null
for row in $COMPS; do
  IFS=: read -r id file frames kind <<<"$row"
  start=$(date +%s.%N)
  npx remotion render out/bundle "$id" "out/previews/$file.mp4" --scale=0.3333333333333333 --gl=angle --crf=16 --pixel-format=yuv420p --codec=h264 >/dev/null
  end=$(date +%s.%N)
  echo "$id rendered in $(echo "$end - $start" | bc) s"
  npx remotion still out/bundle "$id" "out/previews/$file.png" --frame=$((frames / 2)) --scale=0.3333333333333333 --gl=angle >/dev/null
done
