#!/usr/bin/env bash
# Renders the Natural Earth map texture used by the HUD (white on transparent).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/map
npx remotion still src/index.ts Asset-WorldMap public/map/world-fill.png --frame=0 --image-format=png >/dev/null
echo "public/map/world-fill.png written"
