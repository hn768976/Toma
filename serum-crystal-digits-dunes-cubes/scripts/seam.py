#!/usr/bin/env python3
"""Seam smoothness: mean |frame599 - frame0| vs typical consecutive-frame change."""
import sys
import numpy as np
from PIL import Image
d = sys.argv[1]
L = lambda i: np.asarray(Image.open(f"{d}/element-{i:03d}.png").convert("RGB")).astype(np.float32)
seam = np.abs(L(599) - L(0)).mean()
typ = [np.abs(L(i) - L(i + 1)).mean() for i in range(50, 600, 50)]
print(f"seam 599->0 mean abs diff = {seam:.3f}; consecutive diffs: min {min(typ):.3f} mean {np.mean(typ):.3f} max {max(typ):.3f} -> {'OK' if seam <= max(typ) * 1.25 else 'CHECK'}")
