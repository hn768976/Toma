#!/usr/bin/env python3
"""Byte-for-byte + pixel comparison of two PNGs. Usage: compare_png.py a.png b.png"""
import sys, hashlib
from PIL import Image
import numpy as np

a, b = sys.argv[1], sys.argv[2]
pa = np.asarray(Image.open(a).convert("RGB")).astype(int)
pb = np.asarray(Image.open(b).convert("RGB")).astype(int)
ha = hashlib.sha256(pa.tobytes()).hexdigest()[:16]
hb = hashlib.sha256(pb.tobytes()).hexdigest()[:16]
fa = hashlib.sha256(open(a, "rb").read()).hexdigest()[:16]
fb = hashlib.sha256(open(b, "rb").read()).hexdigest()[:16]
if pa.shape != pb.shape:
    print(f"DIFF shape {pa.shape} vs {pb.shape}")
    sys.exit(1)
d = np.abs(pa - pb)
same = int(d.max()) == 0
print(f"{'IDENTICAL' if same else 'DIFFERENT'} pixels sha={ha}/{hb} file sha={fa}/{fb} "
      f"maxdiff={int(d.max())} differing_px={int((d.max(axis=2) > 0).sum())}")
sys.exit(0 if same else 1)
