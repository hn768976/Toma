#!/usr/bin/env python3
"""Banding inspection: contrast-stretch the DARK range of a frame decoded from the mp4.
usage: tools/stretch.py in.png out.png [maxlevel=48]   (levels 0..max -> 0..255)
Contours / steps in smooth falloffs show up as visible rings; grain-dithered
gradients stay smooth. Also prints a numeric check: in slowly-varying dark regions,
the fraction of 9x9-box-averaged values lying within 0.08 of an integer level
(a continuous dithered ramp gives ~16%; hard banding gives much more)."""
import sys
import numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float64)
m = float(sys.argv[3]) if len(sys.argv) > 3 else 48
Image.fromarray(np.clip(a * 255 / m, 0, 255).astype(np.uint8)).save(sys.argv[2])
def box(x, k=9):
    c = np.cumsum(np.cumsum(np.pad(x, ((1, 0), (1, 0))), 0), 1)
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)
fr = []
for ch in range(3):
    lp = box(a[:, :, ch])
    gy, gx = np.gradient(lp)
    g = np.hypot(gx, gy)
    sel = (lp > 3) & (lp < 60) & (g > 0.01) & (g < 0.3)
    if sel.sum() > 1000:
        f = lp[sel]
        fr.append(float((np.abs(f - np.round(f)) < 0.08).mean()))
print("integer-proximity fraction per channel (expect ~0.16 for smooth):", " ".join(f"{v:.3f}" for v in fr))
