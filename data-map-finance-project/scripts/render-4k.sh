#!/usr/bin/env bash
# 4K masters of every composition (H.264, yuv420p, CRF 16, 30 fps).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/4k
grep -v '^#' scripts/compositions.txt | while read -r ID FILE _ _ _; do
  [ -z "$ID" ] && continue
  npx remotion render "$ID" "out/4k/$FILE.mp4" --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
done
