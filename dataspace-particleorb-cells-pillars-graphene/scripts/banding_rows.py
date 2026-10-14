"""Banding read-out for busy frames: per-row median over the full width
(rejects sparse lines/points), then reports the row-to-row steps of the
background profile. usage: banding_rows.py img.png [excl_y0:excl_y1 ...]"""
import sys
from PIL import Image
import numpy as np
a = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(float)
med = np.median(a, axis=1)  # H x 3
keep = np.ones(len(med), bool)
for r in sys.argv[2:]:
    y0, y1 = map(int, r.split(":")); keep[y0:y1] = False
ys = np.where(keep)[0]
prof = med[ys]
steps = []
for i in range(1, len(ys)):
    if ys[i] == ys[i - 1] + 1:
        steps.append(np.abs(prof[i] - prof[i - 1]).max())
steps = np.array(steps)
print("profile every 60 rows:", " ".join(f"y{y}:{int(v[0])},{int(v[1])},{int(v[2])}" for y, v in zip(ys[::60], prof[::60])))
print(f"row-to-row max step={steps.max():.1f}  mean={steps.mean():.2f}  steps>2: {(steps>2).sum()} of {len(steps)}")
