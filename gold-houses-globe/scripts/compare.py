#!/usr/bin/env python3
"""Pixel-exact comparison of two PNGs. Prints byte equality, pixel equality and
the number/max of differing pixels. usage: compare.py a.png b.png"""
import sys, hashlib
import numpy as np
from PIL import Image
a, b = sys.argv[1], sys.argv[2]
ba, bb = open(a, "rb").read(), open(b, "rb").read()
pa = np.asarray(Image.open(a).convert("RGB")).astype(int)
pb = np.asarray(Image.open(b).convert("RGB")).astype(int)
same_px = pa.shape == pb.shape and (pa == pb).all()
d = np.abs(pa - pb) if pa.shape == pb.shape else None
print(f"bytes-identical={ba == bb} pixels-identical={same_px} "
      f"sha256 {hashlib.sha256(ba).hexdigest()[:12]} vs {hashlib.sha256(bb).hexdigest()[:12]}"
      + ("" if d is None else f" diff-pixels={(d.max(axis=2) > 0).sum()} max-diff={d.max()}"))
sys.exit(0 if same_px else 1)
