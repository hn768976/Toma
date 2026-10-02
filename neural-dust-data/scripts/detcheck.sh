#!/usr/bin/env bash
# Step 4: render frame 300 on its own from a cold start and compare with frame 300 of the full PNG-sequence render.
cd "$(dirname "$0")/.."
mkdir -p out/det
for id in "$@"; do
  npx remotion still out/bundle "$id" "out/det/${id}_300.png" --frame=300 --scale=0.3333333333333333 --gl=angle --log=error >/dev/null
  python3 - "$id" <<'PY'
import sys, numpy as np, hashlib
from PIL import Image
i = sys.argv[1]
a = np.asarray(Image.open(f"out/det/{i}_300.png").convert("RGB"))
b = np.asarray(Image.open(f"out/frames/{i}/element-300.png").convert("RGB"))
same = a.shape == b.shape and np.array_equal(a, b)
print(f"{i}: cold frame300 sha={hashlib.sha256(a.tobytes()).hexdigest()[:12]} full={hashlib.sha256(b.tobytes()).hexdigest()[:12]} -> {'PASS (identical pixels)' if same else 'FAIL maxdiff=%d' % np.abs(a.astype(int)-b.astype(int)).max()}")
PY
done
