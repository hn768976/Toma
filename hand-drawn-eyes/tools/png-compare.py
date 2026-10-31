#!/usr/bin/env python3
"""usage: png-compare.py a.png b.png -> byte-identical? pixel-identical?"""
import sys, hashlib
import numpy as np
from PIL import Image
a, b = sys.argv[1], sys.argv[2]
ba, bb = open(a, "rb").read(), open(b, "rb").read()
pa, pb = np.asarray(Image.open(a).convert("RGBA")).astype(int), np.asarray(Image.open(b).convert("RGBA")).astype(int)
same_px = pa.shape == pb.shape and (pa == pb).all()
diff = 0 if pa.shape != pb.shape else int((pa != pb).any(axis=2).sum())
print(f"bytes_identical={ba == bb} pixels_identical={same_px} differing_pixels={diff} sha={hashlib.sha1(ba).hexdigest()[:10]}/{hashlib.sha1(bb).hexdigest()[:10]}")
sys.exit(0 if same_px else 1)
