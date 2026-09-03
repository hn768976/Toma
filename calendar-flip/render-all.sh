#!/usr/bin/env bash
# Renders the 1080p preview deliverables (mp4 + still) for every version.
set -euo pipefail
cd "$(dirname "$0")"
for id in V1-Calendar2026-SunStart V2-Calendar2026-MonStart V3-Calendar2027-SunStart V4-Calendar2027-MonStart; do
  name="${id//-/_}"
  echo "=== $id ==="
  npx remotion render "$id" "out/${name}.mp4" \
    --scale=0.5 --codec=h264 --crf=18 --pixel-format=yuv420p --muted
  npx remotion still "$id" "out/${name}.png" --frame=5 --scale=0.5
done
