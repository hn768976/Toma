#!/bin/bash
# Step 2 (loop: frame 600 == frame 0, rendered with a temporary 601-frame composition)
# Step 3 (determinism: frame 300 from a cold start == frame 300 of the full render)
# usage: tools/loop-and-determinism.sh <CompositionId> <full-render-frames-dir> <workdir>
ID=$1; FRAMES=$2; W=${3:-out/checks/$ID}
mkdir -p "$W"
OPTS="--scale=0.3333333333333333 --gl=angle --log=error"
REMOTION_LOOP_CHECK=1 npx remotion still src/index.ts "$ID" "$W/f600.png" --frame=600 $OPTS >/dev/null 2>&1
REMOTION_LOOP_CHECK=1 npx remotion still src/index.ts "$ID" "$W/f000.png" --frame=0 $OPTS >/dev/null 2>&1
if cmp -s "$W/f600.png" "$W/f000.png"; then echo "$ID step2 loop: frame 600 == frame 0 (byte-identical PNG)"; else
  echo "$ID step2 loop: FAIL"; python3 - "$W/f600.png" "$W/f000.png" <<'PY'
import sys, numpy as np
from PIL import Image
a=np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(int); b=np.asarray(Image.open(sys.argv[2]).convert("RGB")).astype(int)
d=np.abs(a-b); print("  differing pixels:", int((d.sum(2)>0).sum()), "max diff", int(d.max()))
PY
fi
npx remotion still src/index.ts "$ID" "$W/cold300.png" --frame=300 $OPTS >/dev/null 2>&1
FULL=$(ls "$FRAMES"/element-300.png 2>/dev/null || ls "$FRAMES"/element-0300.png)
if cmp -s "$W/cold300.png" "$FULL"; then echo "$ID step3 determinism: cold frame 300 == full-render frame 300 (byte-identical)"; else
  echo "$ID step3 determinism: FAIL"; python3 - "$W/cold300.png" "$FULL" <<'PY'
import sys, numpy as np
from PIL import Image
a=np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(int); b=np.asarray(Image.open(sys.argv[2]).convert("RGB")).astype(int)
d=np.abs(a-b); print("  differing pixels:", int((d.sum(2)>0).sum()), "max diff", int(d.max()))
PY
fi
