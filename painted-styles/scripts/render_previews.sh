#!/usr/bin/env bash
# 720p previews of all 8 clips (H.264, yuv420p, CRF 16, 30 fps, no audio).
#   scripts/render_previews.sh [CompId ...]
# Loops are 601-frame compositions (frame 600 == frame 0 for the loop check); we encode frames 0-599 = 20.0 s.
set -euo pipefail
cd "$(dirname "$0")/../remotion"
mkdir -p ../renders
npx remotion bundle src/index.ts --out-dir ../build/bundle >/dev/null
COMPS=("$@")
if [ ${#COMPS[@]} -eq 0 ]; then
  COMPS=(Painted-Watercolour-LakeLoop Painted-ArtDeco-LakeLoop Painted-StainedGlass-LakeLoop Painted-InkWash-LakeLoop
         Painted-Linocut-LakeLoop Painted-Watercolour-DrawOn Painted-InkWash-DrawOn Painted-StainedGlass-DrawOn)
fi
for c in "${COMPS[@]}"; do
  out="../renders/${c//-/_}.mp4"
  frames=0-359; [[ "$c" == *LakeLoop ]] && frames=0-599
  s=$(date +%s)
  npx remotion render ../build/bundle "$c" "$out" --frames=$frames --scale=0.3333333333333333 --gl=angle \
    --codec=h264 --crf=16 --pixel-format=yuv420p --muted --concurrency=${CONCURRENCY:-3} --log=error
  e=$(( $(date +%s) - s ))
  echo "$c $frames ${e}s" | tee -a ../renders/render_times.txt
done
