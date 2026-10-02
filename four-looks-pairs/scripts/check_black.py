#!/usr/bin/env python3
"""Every pixel must be <= tol in every channel. Usage: check_black.py tol img.png [region x0 y0 x1 y1]"""
import sys
from PIL import Image
import numpy as np

tol = int(sys.argv[1])
a = np.asarray(Image.open(sys.argv[2]).convert("RGB")).astype(int)
if len(sys.argv) > 3:
    x0, y0, x1, y1 = map(int, sys.argv[3:7])
    a = a[y0:y1, x0:x1]
mx = int(a.max())
print(f"{'PASS' if mx <= tol else 'FAIL'} {sys.argv[2]} max={mx} nonzero_px={int((a.max(axis=2) > 0).sum())}")
sys.exit(0 if mx <= tol else 1)
