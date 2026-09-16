#!/usr/bin/env bash
# Renders both grades to 4K PNG sequences under out/frames/.
# Run ./deliver.sh afterwards to encode the masters and the 1080p deliverables.
#
# Rendering goes through render-chunked.sh rather than straight to a video —
# see the header there for why a single long session is not survivable on a
# machine without a GPU.
set -euo pipefail
cd "$(dirname "$0")"

CHUNK="${1:-30}"

for VARIANT in Violet Blue; do
  echo "=========== SpiralFlow-4K-${VARIANT} ==========="
  ./render-chunked.sh "SpiralFlow-4K-${VARIANT}" \
    "out/frames/$(echo "$VARIANT" | tr '[:upper:]' '[:lower:]')" "$CHUNK"
done

echo
echo "Sequences rendered. Next: ./deliver.sh"
