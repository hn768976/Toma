#!/usr/bin/env bash
# Render every 720p preview (PNG sequence + mp4) and a 720p PNG still of each.
set -euo pipefail
cd "$(dirname "$0")/.."
for spec in StockScreen-Teal:2 AIHUD-WhiteOverlay:3 ParticleHeart-Pink:2 ParticleHeart-Red:2 ParticleHeart-Gold:2 \
            MarketMap-Blue:2 MarketMap-Gold:2 LoadingHUD-WhiteOverlay:3; do
  id="${spec%%:*}"; conc="${spec##*:}"
  scripts/preview.sh "$id" "$conc"
done
