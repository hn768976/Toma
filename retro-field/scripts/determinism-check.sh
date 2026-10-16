#!/usr/bin/env bash
# Steps 3 and 6. For each composition:
#  - render frames 270–329 (2 s around frame 300) as a PNG sequence with 4
#    threads, so frames are produced out of order in different tabs;
#  - render frame 300 on its own from a cold start (fresh browser);
#  - compare the two frame-300 PNGs byte for byte.
# The sequence is also what step 6 steps through.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${OUT:-out/determinism}
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && IDS=(RetroMountains-Sunset RetroMountains-Midnight GlassSpiral-Blue GlassSpiral-Amber ParticleSmoke-White FibreTunnel-RedCyan FibreTunnel-VioletGold)
for id in "${IDS[@]}"; do
  mkdir -p "$OUT/$id/seq"
  npx remotion render out/bundle "$id" "$OUT/$id/seq" --sequence --image-format=png \
    --frames=270-329 --scale=0.3333333333333333 --gl=angle --concurrency=4 --log=error
  npx remotion still out/bundle "$id" "$OUT/$id/cold-300.png" --frame=300 \
    --scale=0.3333333333333333 --gl=angle --log=error
  seq300=$(ls "$OUT/$id/seq" | grep -E '0*300\.png$' | head -1)
  python3 scripts/verify.py same "$OUT/$id/seq/$seq300" "$OUT/$id/cold-300.png" || true
done
