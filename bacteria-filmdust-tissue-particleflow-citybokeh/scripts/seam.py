#!/usr/bin/env python3
"""Seam check: the 599 -> 0 step must look like any other frame step.
   python3 scripts/seam.py <OutName>   (uses renders/frames/<OutName>)"""
import sys
import numpy as np
from PIL import Image
name = sys.argv[1]
ld = lambda i: np.asarray(Image.open(f"renders/frames/{name}/element-{i:03d}.png").convert("L")).astype(float)
def d(a, b):
    return float(np.abs(ld(a) - ld(b)).mean())
steps = [d(i, i + 1) for i in (100, 101, 297, 298, 299, 300, 500, 501)]
seam = d(599, 0)
print(f"{name}: mean |step| typical {np.mean(steps):.3f} (min {min(steps):.3f}, max {max(steps):.3f}); seam 599->0 {seam:.3f}")
