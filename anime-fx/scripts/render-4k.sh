#!/usr/bin/env bash
# Render the 4K masters (3840x2160 H.264 yuv420p, CRF 16).
# usage: scripts/render-4k.sh [CompId ...]   (default: all)
set -e
cd "$(dirname "$0")/.."
mkdir -p out/4k
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && IDS=(AnimeShards-Neon AnimeShards-Ice GraffitiWall-Neon GraffitiWall-Paper AnimeFire-Red AnimeFire-Blue StyleWalk-Colours InkFigure-DotBurst)
for id in "${IDS[@]}"; do
  npx remotion render src/index.ts "$id" "out/4k/${id/-/_}.mp4" \
    --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png --muted --concurrency=2
done
