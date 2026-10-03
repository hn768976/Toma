#!/usr/bin/env bash
# Bundle once, then render all nine 720p previews.
set -euo pipefail
npx remotion bundle --out-dir=out/bundle >/dev/null
for pair in GoldMarket-Bull:GoldMarket_Bull GoldMarket-Bear:GoldMarket_Bear \
  PrismLeaks-Cool:PrismLeaks_Cool PrismLeaks-Warm:PrismLeaks_Warm \
  WireframeGears-Blue:WireframeGears_Blue WireframeGears-Amber:WireframeGears_Amber \
  GoldRingFrame-Gold:GoldRingFrame_Gold GoldRingFrame-Silver:GoldRingFrame_Silver \
  DarkTerraces:DarkTerraces; do
  scripts/render-preview.sh "${pair%%:*}" "${pair##*:}" out/bundle
done
