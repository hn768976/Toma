#!/usr/bin/env bash
# Renders every version to the 1080p deliverable from its native 4K composition.
# --scale=0.5 halves 3840x2160 to exactly 1920x1080, so layout and motion have a
# single source of truth and the 4K comps stay the master.
set -euo pipefail
cd "$(dirname "$0")"
SCALE="${SCALE:-0.5}"
OUT="${OUT:-out/1080p}"
CONC="${CONC:-4}"
mkdir -p "$OUT"
for id in V1-Slab V2-Cylinder V3-WideDisc V4-GlassBeam V5-Ringed; do
  echo "=== $id ==="
  npx remotion render "${id}-4K" "$OUT/${id}-1080p.mp4" \
    --scale="$SCALE" --concurrency="$CONC" \
    --codec=h264 --pixel-format=yuv420p --crf=16 --log=error
done
echo "All renders complete -> $OUT"
