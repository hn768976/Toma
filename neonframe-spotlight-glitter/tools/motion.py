#!/usr/bin/env python3
"""Step 6 helper: frame-to-frame statistics from a rendered PNG sequence.
Reports mean luma per frame, mean |frame diff|, and the loop seam (599 -> 0) vs the typical step,
plus the biggest single-frame jumps (pops) and whether the average brightness strobes."""
import sys, glob, numpy as np
from PIL import Image
d = sys.argv[1]
files = sorted(glob.glob(d + "/element-*.png"))
prev = None; lum = []; diffs = []; first = None
for f in files:
    a = np.asarray(Image.open(f).convert("L").resize((320, 180), Image.BILINEAR)).astype(float)
    if first is None: first = a
    lum.append(a.mean())
    if prev is not None: diffs.append(np.abs(a - prev).mean())
    prev = a
seam = np.abs(first - prev).mean()
lum = np.array(lum); diffs = np.array(diffs)
d2 = np.diff(lum, 2)
print(f"{len(files)} frames; mean luma {lum.mean():.2f} (min {lum.min():.2f}, max {lum.max():.2f})")
print(f"frame-to-frame mean|diff|: mean {diffs.mean():.3f}, median {np.median(diffs):.3f}, max {diffs.max():.3f} at frame {diffs.argmax()+1}")
print(f"loop seam diff (frame 599 -> 0): {seam:.3f}  (typical step {np.median(diffs):.3f})")
print(f"mean-luma 2nd difference: std {d2.std():.4f}, max {np.abs(d2).max():.4f}  (strobe/pop indicator)")
