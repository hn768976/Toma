#!/usr/bin/env python3
"""Seam smoothness for a looping PNG sequence: mean abs difference of the
wrap step (last frame -> first frame) against ordinary consecutive steps."""
import sys, glob
import numpy as np
from PIL import Image

d = sys.argv[1]
files = sorted(glob.glob(f"{d}/*.png"))
load = lambda f: np.asarray(Image.open(f).convert("RGB"), dtype=np.float32)
pairs = [(len(files) - 1, 0)] + [(i, i + 1) for i in range(0, len(files) - 1, max(1, len(files) // 12))]
vals = []
for a, b in pairs:
    vals.append(np.abs(load(files[a]) - load(files[b])).mean())
seam, normal = vals[0], vals[1:]
print(f"{d}: seam step {seam:.2f}, ordinary steps {min(normal):.2f}..{max(normal):.2f} (mean {np.mean(normal):.2f})")
