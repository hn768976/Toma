#!/usr/bin/env bash
# Step 2: renders frames 0 and 600 of each loop (compositions made 601
# frames long) and compares the decoded pixels.
set -u
OUT=${1:-out/loopcheck}
mkdir -p "$OUT"
for c in ${COMPS:-AndroidTraderHUD-Left AndroidTraderHUD-Right ServerRack-FrontScroll ServerRack-DiagonalGlide ServerRack-LowAngle}; do
  for f in 0 600; do
    REMOTION_LOOP_CHECK=1 npx remotion still "$c" --frame=$f --scale=0.3333333333333333 "$OUT/$c-$f.png" > /dev/null 2>&1
  done
  python3 - "$OUT/$c-0.png" "$OUT/$c-600.png" "$c" <<'PY'
import sys
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert("RGB"); b = Image.open(sys.argv[2]).convert("RGB")
d = ImageChops.difference(a, b).getbbox()
print(f"{sys.argv[3]}: {'IDENTICAL' if d is None else 'DIFFERENT ' + str(d)}")
PY
done
