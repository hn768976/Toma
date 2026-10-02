#!/usr/bin/env bash
# 6000x3375 PNG stills (2 per composition, far-apart frames) and one 1080p PNG
# still per composition. Canyon frames are ones with the most void in frame
# (see scripts/field-stats.ts): 180 and 390.
# Usage: scripts/render-stills.sh [big|small|all]
set -euo pipefail
cd "$(dirname "$0")/.."
WHAT="${1:-all}"
[ -d build ] || npx remotion bundle --out-dir=build
mkdir -p out/stills out/stills-1080
declare -A FRAMES=(
  [VoxelCanyon-Green]="180 390" [VoxelCanyon-White]="180 390" [VoxelCanyon-Blue]="180 390"
  [VoxelWave-Blue]="90 390" [VoxelWave-Mint]="90 390"
)
for c in VoxelCanyon-Green VoxelCanyon-White VoxelCanyon-Blue VoxelWave-Blue VoxelWave-Mint; do
  name="${c/-/_}"
  set -- ${FRAMES[$c]}
  if [ "$WHAT" != "small" ]; then
    for f in "$@"; do
      npx remotion still build "$c" "out/stills/${name}_f$(printf %04d "$f")_6000x3375.png" \
        --frame="$f" --scale=1.5625 --gl=angle --image-format=png --timeout=900000
    done
  fi
  if [ "$WHAT" != "big" ]; then
    npx remotion still build "$c" "out/stills-1080/${name}.png" \
      --frame="$1" --scale=0.5 --gl=angle --image-format=png --timeout=900000
  fi
done
