#!/usr/bin/env bash
# Render all 8 previews (or the ids given as args) from a fresh bundle.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf build && npx remotion bundle --out-dir=build/bundle >/dev/null
ALL="SummitPath-Blue SummitPath-GoldDawn AIBrainChat-NeonBlue BlackSilk-Black BlackSilk-Champagne EarthGridRise-Blue LightTunnel-White LightTunnel-Graphite"
for id in ${@:-$ALL}; do
  scripts/render-preview.sh "$id" "${id/-/_}"
done
