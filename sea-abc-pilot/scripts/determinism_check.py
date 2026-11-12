"""Compare in-order sequence renders against out-of-order still renders.
usage: python3 scripts/determinism_check.py out/det"""
import sys, os
import numpy as np
from PIL import Image
root = sys.argv[1]
rows, worst = [], 0.0
for sub, rng in (('inorder', range(0, 21)), ('inorder_swim', range(60, 81))):
    for f in rng:
        a = np.asarray(Image.open(f'{root}/{sub}/element-{f:02d}.png').convert('RGB')).astype(int)
        b = np.asarray(Image.open(f'{root}/shuffled/f{f:03d}.png').convert('RGB')).astype(int)
        d = np.abs(a - b)
        rows.append((f, d.max(), (d.max(axis=2) > 2).mean() * 100))
        worst = max(worst, d.max())
for f, mx, pct in rows:
    print(f'frame {f:3d}  max channel diff {mx:3d}  pixels >2: {pct:.4f}%')
print('WORST', worst)
