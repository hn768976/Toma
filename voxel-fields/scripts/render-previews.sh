#!/usr/bin/env bash
# Renders 1080p previews: full PNG sequence (kept for the determinism check),
# then H.264 / yuv420p / CRF 16 / 30 fps / no audio. Logs wall time per comp.
# Usage: scripts/render-previews.sh [CompositionId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
COMPS=("$@")
[ ${#COMPS[@]} -eq 0 ] && COMPS=(VoxelCanyon-Green VoxelCanyon-White VoxelCanyon-Blue VoxelWave-Blue VoxelWave-Mint)
[ -d build ] || npx remotion bundle --out-dir=build
mkdir -p out/frames out/previews out/logs
for c in "${COMPS[@]}"; do
  name="${c/-/_}"
  rm -rf "out/frames/$c"
  t0=$(date +%s)
  npx remotion render build "$c" "out/frames/$c" --sequence --image-format=png \
    --scale=0.5 --concurrency=2 --gl=angle --timeout=900000 > "out/logs/$c.render.log" 2>&1
  t1=$(date +%s)
  ffmpeg -v error -y -framerate 30 -pattern_type glob -i "out/frames/$c/*.png" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 -an -movflags +faststart \
    "out/previews/$name.mp4"
  n=$(ls "out/frames/$c" | wc -l)
  echo "$c frames=$n render_s=$((t1 - t0)) per_frame_s=$(python3 -c "print(round(($t1-$t0)/$n,2))")" | tee -a out/logs/timing.txt
done
