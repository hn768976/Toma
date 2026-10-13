"""Step 6: frame-to-frame change over a 2 s window; a pop shows as a spike
well above the window's median."""
import sys, glob
import numpy as np
from PIL import Image
d, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = sorted(glob.glob(f"{d}/*.png"))
prev = None; diffs = []
for f in files[a:b + 1]:
    x = np.asarray(Image.open(f).convert("L")).astype(np.float32)
    if prev is not None:
        diffs.append(np.abs(x - prev).mean())
    prev = x
diffs = np.array(diffs)
med = np.median(diffs)
ratio = diffs.max() / max(med, 1e-6)
print(f"{d.split('/')[-1]}: frames {a}-{b} mean|Δ| median {med:.3f} max {diffs.max():.3f} max/median {ratio:.2f} -> {'SMOOTH' if ratio < 2.5 else 'CHECK'}")
