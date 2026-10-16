#!/usr/bin/env bash
# Step 2: make each loop 601 frames (--props loopCheck) and compare frame 0
# with frame 600 pixel for pixel.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:?outdir}; mkdir -p "$OUT"
for ID in DataFountain-Loop CodePanels-Dark PastelSilk-PinkBlue PastelSilk-PeachMint TealHUD-Soft LiquidRipples-White LiquidRipples-Black; do
  for F in 0 600; do
    npx remotion still "$ID" "$OUT/$ID-$F.png" --frame=$F --scale=0.3333333333333333 --props='{"loopCheck":true}' --log=error >/dev/null
  done
  python3 - "$OUT/$ID-0.png" "$OUT/$ID-600.png" "$ID" <<'PY'
import sys
from PIL import Image, ImageChops
a, b = Image.open(sys.argv[1]).convert("RGB"), Image.open(sys.argv[2]).convert("RGB")
d = ImageChops.difference(a, b).getbbox()
print(f"{sys.argv[3]}: frame0 vs frame600 {'IDENTICAL' if d is None else 'DIFFER in ' + str(d)} ({a.size[0]}x{a.size[1]})")
PY
done
