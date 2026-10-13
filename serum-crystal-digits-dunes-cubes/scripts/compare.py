#!/usr/bin/env python3
"""Pixel-exact comparison of two PNGs. Exit 0 if identical."""
import sys, hashlib
import numpy as np
from PIL import Image

a, b = sys.argv[1], sys.argv[2]
A = np.asarray(Image.open(a).convert("RGB")).astype(np.int16)
B = np.asarray(Image.open(b).convert("RGB")).astype(np.int16)
ha = hashlib.sha256(A.tobytes()).hexdigest()[:16]
hb = hashlib.sha256(B.tobytes()).hexdigest()[:16]
if A.shape != B.shape:
    print(f"DIFFERENT SIZE {A.shape} vs {B.shape}")
    sys.exit(1)
d = np.abs(A - B)
n = int((d.max(axis=2) > 0).sum())
print(f"{'IDENTICAL' if n == 0 else 'DIFFERENT'}  pixels_differing={n}  max_diff={int(d.max())}  sha_a={ha} sha_b={hb}")
sys.exit(0 if n == 0 else 1)
