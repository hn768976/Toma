import sys
import numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(int)
mode = sys.argv[2]
if mode == "corners":
    h, w, _ = a.shape
    s = 32
    regs = [a[:s, :s], a[:s, -s:], a[-s:, :s], a[-s:, -s:]]
    m = max(r.max() for r in regs)
else:
    m = a.max()
print(f"{sys.argv[1]} [{mode}] max channel value = {m} -> {'PASS' if m <= 1 else 'FAIL'}")
