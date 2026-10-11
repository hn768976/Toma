#!/usr/bin/env bash
# Loop + determinism + timing checks for one composition at 720p (scale 1/3).
#   loop:  frame 0 vs frame 600 of a 601-frame build (REMOTION_LOOP_CHECK=1), pixel for pixel
#   det:   frame 300 rendered alone from a cold start vs frame 300 inside a multi-frame,
#          multi-tab sequence render (frames 270-329) — compared on the decoded pixels
#   time:  per-frame render time = (T[60-frame sequence] - T[cold single still]) / 59
# The 60-frame sequence is kept for the motion and banding checks.
# Usage: scripts/verify.sh <CompositionId> [outdir]
set -euo pipefail
ID=$1
OUT=${2:-out/verify}/$ID
SCALE=0.3333333333333333
mkdir -p "$OUT"
REMOTION_LOOP_CHECK=1 npx remotion still src/index.ts "$ID" "$OUT/f0.png" --frame=0 --scale=$SCALE >/dev/null 2>&1
REMOTION_LOOP_CHECK=1 npx remotion still src/index.ts "$ID" "$OUT/f600.png" --frame=600 --scale=$SCALE >/dev/null 2>&1
T0=$(date +%s.%N)
npx remotion still src/index.ts "$ID" "$OUT/cold300.png" --frame=300 --scale=$SCALE >/dev/null 2>&1
T1=$(date +%s.%N)
rm -rf "$OUT/seq"
npx remotion render src/index.ts "$ID" "$OUT/seq" --sequence --image-format=png --frames=270-329 --scale=$SCALE >/dev/null 2>&1
T2=$(date +%s.%N)
SEQ300=$(ls "$OUT"/seq/*.png | sort | sed -n '31p')
python3 - "$OUT/f0.png" "$OUT/f600.png" "$OUT/cold300.png" "$SEQ300" "$ID" "$T0" "$T1" "$T2" <<'PY'
import sys, numpy as np
from PIL import Image
f0, f600, c300, s300, cid, t0, t1, t2 = sys.argv[1:]
a = lambda p: np.asarray(Image.open(p).convert("RGB")).astype(int)
A, B, C, D = a(f0), a(f600), a(c300), a(s300)
loop = np.abs(A - B).max(); det = np.abs(C - D).max()
still = float(t1) - float(t0); seq = float(t2) - float(t1)
per = (seq - still) / 59
print(f"{cid}: size={A.shape[1]}x{A.shape[0]} loop_maxdiff={loop} ({'PASS' if loop == 0 else 'FAIL'}) "
      f"det_maxdiff={det} ({'PASS' if det == 0 else 'FAIL'}) still={still:.1f}s seq60={seq:.1f}s "
      f"per_frame~{per:.2f}s")
PY
