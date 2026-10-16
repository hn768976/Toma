#!/usr/bin/env bash
# Step 2: with 601-frame compositions, frame 600 must equal frame 0 exactly.
# Also renders frames 598/599 to compare the size of the seam step (599→600)
# with an ordinary step (598→599).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${OUT:-out/loopcheck}
mkdir -p "$OUT"
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && IDS=(RetroMountains-Sunset RetroMountains-Midnight GlassSpiral-Blue GlassSpiral-Amber ParticleSmoke-White FibreTunnel-RedCyan FibreTunnel-VioletGold)
for id in "${IDS[@]}"; do
  for f in 0 598 599 600; do
    npx remotion still out/bundle "$id" "$OUT/$id-$f.png" --frame=$f --scale=0.3333333333333333 \
      --gl=angle --props='{"loopCheck":true}' --log=error &
  done
  wait
  python3 scripts/verify.py same "$OUT/$id-0.png" "$OUT/$id-600.png" || true
  python3 - "$OUT/$id" <<'PY'
import sys
from PIL import Image, ImageChops, ImageStat
b = sys.argv[1]
def d(a, c):
    return sum(ImageStat.Stat(ImageChops.difference(Image.open(f"{b}-{a}.png").convert("RGB"), Image.open(f"{b}-{c}.png").convert("RGB"))).mean) / 3
print(f"  mean |598-599| = {d(598, 599):.2f}   mean |599-600| (seam) = {d(599, 600):.2f}")
PY
done
