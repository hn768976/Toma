#!/usr/bin/env bash
# Loop seam and determinism checks at 720p.
#  1. renders the 601-frame verify variant as a PNG sequence (one full render);
#  2. frame 0 vs frame 600 must match pixel for pixel;
#  3. a cold-start still of frame 300 (a fresh process) must match the
#     sequence's frame 300 byte for byte.
# Usage: bash scripts/verify.sh [Name ...]
set -euo pipefail
cd "$(dirname "$0")/.."
names=("$@")
[ ${#names[@]} -eq 0 ] && names=(OverbalancedWheel WaterScrewMill SelfFlowingFlask MagnetRamp RollingBallWheel)
for n in "${names[@]}"; do
  dir="renders/verify/$n"
  rm -rf "$dir"; mkdir -p "$dir/seq"
  npx remotion render src/index.ts "PerpetualMotion-$n" "$dir/seq" --sequence --image-format=png \
    --props='{"look":"workshop","verify":true}' --scale=0.3333333333333333 --concurrency=4 --log=error
  npx remotion still src/index.ts "PerpetualMotion-$n" "$dir/cold-300.png" --frame=300 \
    --props='{"look":"workshop","verify":true}' --scale=0.3333333333333333 --log=error
  python3 scripts/compare.py "$n" "$dir"
done
