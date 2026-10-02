#!/usr/bin/env bash
# Final 4K masters: 3840x2160, H.264, yuv420p, CRF 16, 30 fps, no audio.
# Usage: bash tools/render-4k.sh [CompositionId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
source tools/comps.sh
mkdir -p renders/4k
for row in "${COMPS[@]}"; do
  IFS='|' read -r id name fa fb <<< "$row"
  if [ $# -gt 0 ] && [[ ! " $* " == *" $id "* ]]; then continue; fi
  npx remotion render "$id" "renders/4k/${name}_4K.mp4"
done
