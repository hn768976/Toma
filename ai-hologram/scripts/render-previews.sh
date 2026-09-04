#!/usr/bin/env bash
# 1080p preview pass for both versions. The compositions are 4K; --scale=0.5
# renders them at 1920x1080 without changing a single layout number.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out

render() {
  local id="$1" name="$2"
  echo "=== $name ==="
  local t0=$SECONDS
  npx remotion render "$id" "out/${name}.mp4" \
    --scale=0.5 --codec=h264 --pixel-format=yuv420p --crf=18 --muted --concurrency=4
  echo "TIMING ${name} video ${id}: $((SECONDS - t0))s wall for 600 frames"
  npx remotion still "$id" "out/${name}.png" --frame=450 --scale=0.5
}

render V1-AIHologramDarkBlue V1_AIHologramDarkBlue
render V2-AIHologramDarkCyan V2_AIHologramDarkCyan
