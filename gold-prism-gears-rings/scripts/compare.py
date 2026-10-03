"""Pixel-exact comparison of two PNGs (decoded pixels, not file bytes)."""
import sys
import numpy as np
from PIL import Image

a = np.asarray(Image.open(sys.argv[1]).convert("RGB"), dtype=np.int16)
b = np.asarray(Image.open(sys.argv[2]).convert("RGB"), dtype=np.int16)
label = sys.argv[3] if len(sys.argv) > 3 else ""
if a.shape != b.shape:
    print(f"{label}: FAIL shape {a.shape} vs {b.shape}")
    sys.exit(1)
d = np.abs(a - b)
n = int((d.max(axis=2) > 0).sum())
print(f"{label}: {'PASS identical' if n == 0 else 'FAIL'} ({n} differing pixels, max diff {int(d.max())}) {a.shape[1]}x{a.shape[0]}")
sys.exit(0 if n == 0 else 1)
