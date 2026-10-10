#!/usr/bin/env python3
"""tools/cmp.py a.png b.png label -> byte-for-byte pixel comparison."""
import sys
import numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert("RGB"))
b = np.asarray(Image.open(sys.argv[2]).convert("RGB"))
same = a.shape == b.shape and np.array_equal(a, b)
d = 0 if same else int(np.abs(a.astype(int) - b.astype(int)).max()) if a.shape == b.shape else -1
n = 0 if same else int((a != b).any(axis=2).sum()) if a.shape == b.shape else -1
print(f"{'PASS' if same else 'FAIL'}  {sys.argv[3]}  (max diff {d}, differing px {n})")
