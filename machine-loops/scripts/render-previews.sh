#!/usr/bin/env bash
# Renders the 720p previews (1280x720, H.264, yuv420p, CRF 16, 30 fps).
# Usage: bash scripts/render-previews.sh [CompositionId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out
ALL=(SteampunkFrame-White SteampunkFrame-Green RobotWalk-Turnaround RobotWalk-Loop RobotWalk-Green MachineBlueprint-Beam OceanDepth-Labelled OceanDepth-Clean)
[ $# -gt 0 ] && IDS=("$@") || IDS=("${ALL[@]}")
for id in "${IDS[@]}"; do
  name="${id/-/_}"
  extra=()
  # the line drawing on pure black: slower x264 preset keeps H.264 ringing off the black
  [ "$id" = MachineBlueprint-Beam ] && extra=(--x264-preset=veryslow)
  start=$(date +%s.%N)
  npx remotion render src/index.ts "$id" "out/${name}.mp4" \
    --scale=0.3333333333333333 --gl=angle --image-format=png \
    --codec=h264 --pixel-format=yuv420p --crf=16 --muted \
    --concurrency="${CONCURRENCY:-4}" --timeout=120000 --log=error "${extra[@]}"
  end=$(date +%s.%N)
  frames=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "out/${name}.mp4")
  awk -v n="$name" -v a="$start" -v b="$end" -v f="$frames" 'BEGIN { printf "%s: %.1f s total, %d frames, %.3f s/frame\n", n, b - a, f, (b - a) / f }' | tee -a out/timings.txt
done
