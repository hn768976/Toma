#!/usr/bin/env bash
# 1080p preview deliverables. 4K is rendered separately -- see README.md.
set -euo pipefail
cd "$(dirname "$0")/.."
render() {
  npx remotion render "$1" "out/$2.mp4" --scale=0.5 --crf=16 --pixel-format=yuv420p
  npx remotion still  "$1" "out/$2.png" --frame=210 --scale=0.5
}
render V1-FoggyForestTeal  V1_FoggyForestTeal
render V2-FoggyForestAmber V2_FoggyForestAmber
render V3-FoggyForestMono  V3_FoggyForestMono
echo "ALL RENDERS COMPLETE"
