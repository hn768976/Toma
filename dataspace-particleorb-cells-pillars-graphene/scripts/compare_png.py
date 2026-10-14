"""Compare two PNGs pixel for pixel (decoded RGB) and byte for byte."""
import sys, hashlib
from PIL import Image
import numpy as np

a, b = sys.argv[1], sys.argv[2]
ia = np.asarray(Image.open(a).convert("RGB")).astype(np.int16)
ib = np.asarray(Image.open(b).convert("RGB")).astype(np.int16)
same_bytes = hashlib.sha256(open(a, "rb").read()).hexdigest() == hashlib.sha256(open(b, "rb").read()).hexdigest()
if ia.shape != ib.shape:
    print(f"SHAPE MISMATCH {ia.shape} {ib.shape}"); sys.exit(1)
d = np.abs(ia - ib)
n = int((d.max(axis=2) > 0).sum())
print(f"pixels_differing={n} max_diff={int(d.max())} bytes_identical={same_bytes}")
sys.exit(0 if n == 0 else 1)
