# Usage: python3 compare_png.py a.png b.png  -> exits 0 if pixel-identical
import sys, hashlib
from PIL import Image
import numpy as np
a, b = sys.argv[1], sys.argv[2]
ia, ib = np.asarray(Image.open(a).convert("RGBA")), np.asarray(Image.open(b).convert("RGBA"))
same_bytes = hashlib.sha256(open(a, "rb").read()).hexdigest() == hashlib.sha256(open(b, "rb").read()).hexdigest()
if ia.shape != ib.shape:
    print(f"DIFFERENT SIZE {ia.shape} vs {ib.shape}"); sys.exit(1)
diff = np.abs(ia.astype(int) - ib.astype(int))
n = int((diff.max(axis=2) > 0).sum())
print(f"bytes_identical={same_bytes} differing_pixels={n} max_diff={int(diff.max())}")
sys.exit(0 if n == 0 else 1)
