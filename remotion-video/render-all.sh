#!/usr/bin/env bash
# Renders every grade to a PNG sequence under out/frames/.
# Run ./deliver.sh afterwards to encode the videos.
#
#   ./render-all.sh [tier] [chunk-size]
#
# `tier` is 1080 (default) or 4K, and picks which composition to render. The 4K
# compositions are the masters and are what the project is built around; 1080 is
# there for previews and for machines without a GPU, where a 4K sequence costs
# roughly four times as long for a deliverable that is downscaled anyway.
#
# Rendering goes through render-chunked.sh rather than straight to a video —
# see the header there for why a single long session is not survivable on a
# machine without a GPU.
set -euo pipefail
cd "$(dirname "$0")"

TIER="${1:-1080}"
CHUNK="${2:-30}"
# Keep in step with GRADES in src/spiral-flow/palette.ts.
VARIANTS=(Violet Blue Emerald Ember)

case "$TIER" in
  1080|4K) ;;
  *) echo "tier must be 1080 or 4K, got '${TIER}'" >&2; exit 1 ;;
esac

for VARIANT in "${VARIANTS[@]}"; do
  echo "=========== SpiralFlow-${TIER}-${VARIANT} ==========="
  ./render-chunked.sh "SpiralFlow-${TIER}-${VARIANT}" \
    "out/frames/$(echo "$VARIANT" | tr '[:upper:]' '[:lower:]')" "$CHUNK"
done

echo
echo "Sequences rendered. Next: ./deliver.sh"
