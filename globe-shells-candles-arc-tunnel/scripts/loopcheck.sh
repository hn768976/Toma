#!/bin/bash
# Step 2: render frames 0 and 600 of a 601-frame version and compare pixels.
# Also reports the 599->0 wrap difference next to the 0->1 difference.
# usage: scripts/loopcheck.sh <comp> [comp...]   (expects ./build bundle)
mkdir -p out/check
for c in "$@"; do
  for f in 0 1 599 600; do
    npx remotion still build "$c" "out/check/${c}_$f.png" --frame=$f --scale=0.3333333333333333 --props='{"loopCheck":true}' >/dev/null 2>&1 \
      || { echo "$c frame $f FAILED"; continue 2; }
  done
  python3 - "$c" <<'PY'
import sys, numpy as np
from PIL import Image
c=sys.argv[1]
L=lambda f: np.asarray(Image.open(f"out/check/{c}_{f}.png").convert("RGB")).astype(int)
a0,a1,a599,a600=L(0),L(1),L(599),L(600)
same=np.array_equal(a0,a600)
print(f"{c}: frame0==frame600 {'IDENTICAL' if same else 'DIFFERENT (max %d)'%np.abs(a0-a600).max()} | mean|599-0|={np.abs(a599-a0).mean():.3f} mean|0-1|={np.abs(a0-a1).mean():.3f}")
PY
done
