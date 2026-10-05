#!/usr/bin/env bash
# Step 2: extend the composition to 601 frames, render frames 0 and 600, compare pixels.
# Also reports the 599->600 step next to the 0->1 step (seam continuity).
# usage: scripts/verify-loop.sh <CompositionId>
set -euo pipefail
ID="$1"; D="out/verify/$ID"; mkdir -p "$D"
B="${BUNDLE:-src/index.ts}"
for f in 0 1 599 600; do
  npx remotion still "$B" "$ID" "$D/loop_$f.png" --frame=$f --props='{"durationInFrames":601}' \
    --scale=0.3333333333333333 --gl="${GL:-angle}" --log=error
done
python3 - "$D" <<'PY'
import sys, numpy as np
from PIL import Image
d=sys.argv[1]
L=lambda f: np.asarray(Image.open(f"{d}/loop_{f}.png").convert("RGB")).astype(int)
a,b=L(0),L(600)
same=np.array_equal(a,b)
s01=np.abs(L(1)-a).mean(); s599=np.abs(a-L(599)).mean()
print(f"frame0==frame600: {same} (max diff {np.abs(a-b).max()}); mean step 0->1 {s01:.3f}, 599->600 {s599:.3f}")
PY
