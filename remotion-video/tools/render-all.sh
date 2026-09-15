#!/usr/bin/env bash
# Renders every version to 1080p H.264.
#
# The 4K compositions are registered alongside these and render with the
# same command and a "-4K" suffix on the id; they are not produced here
# because a software-rasterised 4K pass costs roughly four times as much
# per frame.
#
# Usage: tools/render-all.sh [output-dir]
set -euo pipefail

OUT="${1:-out/1080p}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p "$OUT"

BUNDLE="$(mktemp -d)/bundle"
echo "Bundling..."
npx remotion bundle --out-dir="$BUNDLE"

IDS=(
  01-PlaqueClean
  02-CariesFormation
  03-Biofilm
  04-GingivalDisease
  05-GumRestoration
  06-TartarCrystals
  07-WireframeScan
  08-WhiteningArch
  09-EnamelSparkle
)

for id in "${IDS[@]}"; do
  echo "=== $id ==="
  npx remotion render "$BUNDLE" "$id" "$OUT/$id.mp4" \
    --codec=h264 \
    --crf=17 \
    --pixel-format=yuv420p \
    --concurrency=2 \
    --timeout=180000 \
    --log=error
done

echo "Done. Output in $OUT"
