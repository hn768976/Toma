#!/usr/bin/env bash
# Renders the six container-yard shots at 1080p, H.264 in an MP4 container.
# The 4K compositions are registered in the project but not rendered here --
# see README for the one-line command that produces them.
set -u
cd "$(dirname "$0")/.."
OUT=out/deliverables
mkdir -p "$OUT"

SHOTS="Yard01DockWall Yard02GoldenTruck Yard03GridWall Yard04AerialRows Yard05TwinStacks Yard06CornerDusk"

for id in $SHOTS; do
  echo "=== $id  $(date +%T)"
  npx remotion render "$id" "$OUT/${id}_1080p.mp4" \
    --codec=h264 \
    --crf=17 \
    --gl=angle \
    --concurrency=4 \
    --timeout=900000 \
    --log=error 2>&1 | tail -3
  echo "--- $id done $(date +%T)  $(ls -la $OUT/${id}_1080p.mp4 2>/dev/null | awk '{print $5}') bytes"
done
echo "ALL RENDERS COMPLETE $(date +%T)"
