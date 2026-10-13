#!/usr/bin/env bash
# Render + verify every composition at 720p (see render-verify.sh).
set -u
cd "$(dirname "$0")/.."
IDS="${*:-RibbonLayers-Blue RibbonLayers-Coral CircuitCubes-Blue SlatRibbon-GraphiteOrange SlatRibbon-GraphiteCyan HoloLiquid-HoloBlue HoloLiquid-GoldRose CloudNetwork-Blue}"
for id in $IDS; do
  echo "=== $id $(date +%T)"
  scripts/render-verify.sh "$id" out/bundle || echo "FAILED $id"
done
echo "=== all done $(date +%T)"
