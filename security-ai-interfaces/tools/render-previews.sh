#!/usr/bin/env bash
# 1080p previews (H.264, yuv420p, CRF 16, 30 fps, no audio) + 1080p PNG still.
# Usage: bash tools/render-previews.sh [CompositionId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
source tools/comps.sh
mkdir -p renders/previews renders/stills-1080
for row in "${COMPS[@]}"; do
  IFS='|' read -r id name fa fb <<< "$row"
  if [ $# -gt 0 ] && [[ ! " $* " == *" $id "* ]]; then continue; fi
  echo "== $id"
  start=$(date +%s.%N)
  npx remotion render "$id" "renders/previews/$name.mp4" --scale=0.5 --concurrency=4 --log=error
  end=$(date +%s.%N)
  echo "$id $(echo "($end - $start) / 600" | bc -l)" >> renders/previews/timings.txt
  npx remotion still "$id" "renders/stills-1080/$name.png" --frame="$fa" --scale=0.5 --log=error
done
