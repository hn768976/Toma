#!/bin/bash
# Seam check: the step 599 -> 0 must be no bigger than an ordinary step 0 -> 1.
mkdir -p out/verify/seam
for id in CloudSea-Loop RainbowRings-Spectrum SunLeaves-Summer SunLeaves-Autumn DataGrid-Teal RippleRings-Blue; do
  for f in 0 1 599; do
    npx remotion still build $id out/verify/seam/${id}_$f.png --frame=$f --scale=0.3333333333333333 >/dev/null 2>&1
  done
  python3 - "$id" <<'PY'
import sys
from PIL import Image
import numpy as np
i = sys.argv[1]
L = lambda f: np.asarray(Image.open(f"out/verify/seam/{i}_{f}.png").convert("RGB")).astype(float)
a, b, z = L(0), L(1), L(599)
print(f"{i}: mean |0-1| = {np.abs(a-b).mean():.3f}   mean |599-0| = {np.abs(z-a).mean():.3f}")
PY
done
