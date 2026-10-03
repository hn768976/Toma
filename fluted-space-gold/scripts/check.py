"""Verification helpers: loop / determinism / banding / ffprobe. usage:
  python3 scripts/check.py same a.png b.png
  python3 scripts/check.py banding img.png   (row/column profile step analysis)
"""
import sys, json, subprocess
import numpy as np
from PIL import Image

def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)

cmd = sys.argv[1]
if cmd == "same":
    a, b = load(sys.argv[2]), load(sys.argv[3])
    if a.shape != b.shape: print("SHAPE DIFF", a.shape, b.shape); sys.exit(1)
    d = (a != b).any(-1).sum()
    print("IDENTICAL" if d == 0 else f"DIFF pixels={d} max={abs(a-b).max()}"); sys.exit(0 if d == 0 else 1)
if cmd == "banding":
    a = load(sys.argv[2]).astype(float)
    lum = a @ np.array([0.299, 0.587, 0.114])
    # smooth along the gradient with a box filter to remove grain, then look for flat runs + jumps:
    # a banded gradient shows plateaus (zero slope) separated by 1-level steps.
    from numpy.lib.stride_tricks import sliding_window_view as sw
    k = 15
    rows = [lum.shape[0] // 4, lum.shape[0] // 2, 3 * lum.shape[0] // 4]
    for r in rows:
        line = lum[r - 3:r + 4].mean(0)
        sm = sw(line, k).mean(-1)
        d = np.diff(sm)
        plateau = (np.abs(d) < 0.02).mean()
        print(f"row {r}: range {line.min():.0f}-{line.max():.0f}  max step(smoothed) {np.abs(d).max():.2f}  "
              f"flat fraction {plateau:.2f}  unique raw values {len(np.unique(np.round(line)))}")
