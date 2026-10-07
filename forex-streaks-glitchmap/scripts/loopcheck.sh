#!/usr/bin/env bash
# Step 2: frame 600 must be identical to frame 0, pixel for pixel.
# Renders both frames as PNG stills from a 601-frame variant of the composition.
# usage: scripts/loopcheck.sh <CompositionId> [scale]   (default scale = 720p preview)
set -euo pipefail
ID="$1"; SCALE="${2:-0.3333333333333333}"
OUT="${OUT_DIR:-out/checks}"; mkdir -p "$OUT"
for F in 0 600; do
  npx remotion still "$ID" "$OUT/$ID.loop$F.png" --frame=$F --scale="$SCALE" \
    --props='{"extendForLoopCheck":true}' >/dev/null 2>&1
done
if cmp -s "$OUT/$ID.loop0.png" "$OUT/$ID.loop600.png"; then
  echo "LOOP OK   $ID: frame 600 == frame 0 (byte-identical PNG)"
else
  python3 -I - "$OUT/$ID.loop0.png" "$OUT/$ID.loop600.png" <<'PY'
import sys, numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(int)
b = np.asarray(Image.open(sys.argv[2]).convert("RGB")).astype(int)
d = np.abs(a - b)
print(f"LOOP FAIL: {int((d.sum(axis=2) > 0).sum())} differing pixels, max diff {d.max()}")
PY
  exit 1
fi
