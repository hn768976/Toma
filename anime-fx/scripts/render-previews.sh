#!/usr/bin/env bash
# Render 720p previews of all 8 compositions (1280x720 H.264 yuv420p, CRF 16).
# usage: scripts/render-previews.sh [CompId ...]   (default: all)
set -e
cd "$(dirname "$0")/.."
mkdir -p out
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && IDS=(AnimeShards-Neon AnimeShards-Ice GraffitiWall-Neon GraffitiWall-Paper AnimeFire-Red AnimeFire-Blue StyleWalk-Colours InkFigure-DotBurst)
for id in "${IDS[@]}"; do
  name=${id/-/_}
  start=$(date +%s.%N)
  npx remotion render src/index.ts "$id" "out/$name.mp4" \
    --scale=0.3333333333333333 --codec=h264 --pixel-format=yuv420p --crf=16 \
    --image-format=png --muted --concurrency=4 --log=error
  end=$(date +%s.%N)
  frames=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "out/$name.mp4")
  python3 -c "t=$end-$start; print(f'$name: {t:.1f}s total, {t/$frames*1000:.0f} ms/frame ({$frames} frames)')" | tee -a out/render-times.txt
done
