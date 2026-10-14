"""Seam smoothness: mean abs diff 599->0 vs typical consecutive-frame diffs."""
import sys
from PIL import Image
import numpy as np
d = sys.argv[1]  # directory with element-XXX.png named by frame
def load(i):
    import glob
    f = sorted(glob.glob(f"{d}/*-{i:03d}.png"))[0]
    return np.asarray(Image.open(f).convert("RGB")).astype(np.float32)
pairs = [(599, 0), (0, 1), (299, 300), (598, 599)]
for a, b in pairs:
    print(f"{a}->{b}: mean_abs_diff={np.abs(load(a) - load(b)).mean():.3f}")
