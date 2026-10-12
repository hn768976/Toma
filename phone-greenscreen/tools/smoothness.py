#!/usr/bin/env python3
"""Step 6 helper: track the phone through a window of PNG frames and report
per-frame motion of its silhouette (centroid + bounding box), plus the largest
change in velocity (a pop shows up as a spike).

  smoothness.py <seq_dir> <first> <last> <green|bg-sample>
"""
import sys

import numpy as np
from PIL import Image

d, a, b, mode = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
rows = []
for f in range(a, b + 1):
    img = np.asarray(Image.open(f"{d}/element-{f:03d}.png").convert("RGB")).astype(int)
    if mode == "green":
        green = (img[..., 1] > 240) & (img[..., 0] < 40) & (img[..., 2] < 40)
        # phone = dark frame pixels (not green)
        m = ~green & (img.sum(2) < 600)
    else:
        bg = img[4, 4]
        m = np.abs(img - bg).max(2) > 40
    ys, xs = np.nonzero(m)
    if len(xs) < 50:
        rows.append((f, np.nan, np.nan, np.nan, np.nan))
        continue
    rows.append((f, xs.mean(), ys.mean(), xs.max() - xs.min(), ys.max() - ys.min()))
r = np.array(rows, float)
vel = np.diff(r[:, 1:3], axis=0)
acc = np.diff(vel, axis=0)
for row in r:
    print("f%3d cx %7.2f cy %7.2f w %6.1f h %6.1f" % tuple(row))
ok = ~np.isnan(acc).any(1)
if ok.any():
    i = np.nanargmax(np.abs(acc[ok]).max(1))
    print("max |accel| (px/frame^2): %.2f   max |vel| (px/frame): %.2f" % (
        np.abs(acc[ok]).max(), np.nanmax(np.abs(vel))))
