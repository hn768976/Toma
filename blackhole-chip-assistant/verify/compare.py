"""Pixel-for-pixel comparison of two images. Usage: compare.py a.png b.png"""
import sys
import numpy as np
from PIL import Image

a = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.int16)
b = np.asarray(Image.open(sys.argv[2]).convert("RGB")).astype(np.int16)
if a.shape != b.shape:
    print(f"DIFFERENT SIZE {a.shape} vs {b.shape}")
    sys.exit(1)
d = np.abs(a - b)
n = int((d.max(axis=2) > 0).sum())
print(f"pixels differing: {n} / {a.shape[0]*a.shape[1]}  max diff: {int(d.max())}  mean diff: {d.mean():.5f}")
sys.exit(0 if n == 0 else 1)
