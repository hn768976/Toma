#!/usr/bin/env bash
# Step 3: render frame 300 alone from a cold start; compare with frame 300 of the full sequence render.
# usage: scripts/verify-determinism.sh <CompositionId>
set -euo pipefail
ID="$1"; D="out/verify/$ID"; mkdir -p "$D"
npx remotion still "${BUNDLE:-src/index.ts}" "$ID" "$D/cold_300.png" --frame=300 \
  --scale=0.3333333333333333 --gl="${GL:-angle}" --log=error
python3 - "$D/cold_300.png" "out/frames/$ID/element-300.png" <<'PY'
import sys, hashlib, numpy as np
from PIL import Image
a=np.asarray(Image.open(sys.argv[1]).convert("RGB")); b=np.asarray(Image.open(sys.argv[2]).convert("RGB"))
ha=hashlib.sha256(a.tobytes()).hexdigest()[:16]; hb=hashlib.sha256(b.tobytes()).hexdigest()[:16]
print(f"cold {ha}  full {hb}  identical: {ha==hb}")
PY
