#!/usr/bin/env bash
# Step 2: render frames 0 and 600 of a 601-frame version of each loop and compare pixels.
# usage: scripts/loopcheck.sh <compId> [compId...]   (uses out/bundle)
cd "$(dirname "$0")/.."
mkdir -p out/loop
for id in "$@"; do
  for f in 0 600; do
    npx remotion still out/bundle "$id" "out/loop/${id}_$f.png" --frame=$f --scale=0.3333333333333333 \
      --gl=angle --props='{"durationOverride":601}' --log=error >/dev/null
  done
  python3 - "$id" <<'PY'
import sys, numpy as np
from PIL import Image
i = sys.argv[1]
a = np.asarray(Image.open(f"out/loop/{i}_0.png").convert("RGB")).astype(int)
b = np.asarray(Image.open(f"out/loop/{i}_600.png").convert("RGB")).astype(int)
d = np.abs(a - b)
print(f"{i}: frame0 vs frame600  max diff={d.max()}  differing px={(d.max(axis=2) > 0).sum()}  -> {'PASS' if d.max() == 0 else 'FAIL'}")
PY
done
