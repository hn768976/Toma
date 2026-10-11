#!/usr/bin/env bash
# Batch-render all 17 compositions at 3840x2160 (H.264, yuv420p, CRF 16).
# Output names use the deliverable form Planet_Mars_Spin.mp4 (Remotion ids
# use hyphens: Planet-Mars-Spin).
# Usage: bash scripts/render-all-4k.sh [out-dir]
#   REMOTION_GL=angle (default; uses the GPU) or swangle (software)
#   REMOTION_CONCURRENCY=2 (each tab holds ~1 GB of 8K maps)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-out/4k}"
mkdir -p "$OUT"
npx remotion bundle --out-dir=build >/dev/null
COMPS=(
  Planet-Mercury-Spin Planet-Venus-Spin Planet-Mars-Spin Planet-Jupiter-Spin
  Planet-Saturn-Spin Planet-Uranus-Spin Planet-Neptune-Spin
  DwarfPlanet-Pluto-Spin DwarfPlanet-Ceres-Spin
  Planet-Mercury-Crescent Planet-Venus-Crescent Planet-Mars-Crescent
  Planet-Jupiter-Crescent Planet-Saturn-Crescent Planet-Uranus-Crescent
  Planet-Neptune-Crescent DwarfPlanet-Pluto-Crescent
)
for c in "${COMPS[@]}"; do
  name="${c//-/_}"
  echo "=== $c -> $OUT/$name.mp4"
  npx remotion render build "$c" "$OUT/$name.mp4" \
    --codec=h264 --crf=16 --pixel-format=yuv420p --muted \
    --gl="${REMOTION_GL:-angle}" --concurrency="${REMOTION_CONCURRENCY:-2}"
done
