#!/bin/bash
# Step 3: render frame 300 on its own from a cold start and compare byte for
# byte with frame 300 extracted from a full PNG-sequence render.
# usage: scripts/coldcheck.sh <comp> <full_seq_dir>
c=$1; dir=$2
npx remotion still build "$c" "out/check/${c}_cold300.png" --frame=300 --scale=0.3333333333333333 >/dev/null 2>&1
python3 - "$c" "$dir" <<'PY'
import sys, glob, numpy as np
from PIL import Image
c,d=sys.argv[1],sys.argv[2]
seq=sorted(glob.glob(f"{d}/*.png"))[300]
a=np.asarray(Image.open(f"out/check/{c}_cold300.png")); b=np.asarray(Image.open(seq))
print(f"{c}: cold frame 300 vs full-render frame 300 ({seq.split('/')[-1]}):", "IDENTICAL" if a.shape==b.shape and np.array_equal(a,b) else "DIFFERENT")
PY
