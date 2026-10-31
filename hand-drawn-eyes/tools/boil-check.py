#!/usr/bin/env python3
"""Boil check on a lossless PNG sequence: for 24 consecutive frames, report
which frames change (and how much) in a region, and the drift of the drawing's
centre of mass (to catch position jumps).
usage: boil-check.py <seq_dir> <start> <x0,y0,x1,y1> <bg 0|255> [label]"""
import sys
import numpy as np
from PIL import Image
d, start, box, bg = sys.argv[1], int(sys.argv[2]), sys.argv[3], int(sys.argv[4])
label = sys.argv[5] if len(sys.argv) > 5 else ""
x0, y0, x1, y1 = map(int, box.split(","))
frames = []
for f in range(start, start + 25):
    a = np.asarray(Image.open(f"{d}/element-{f:03d}.png").convert("L"), dtype=np.int16)[y0:y1, x0:x1]
    frames.append(a if bg == 0 else 255 - a)
changes, cms = [], []
for i, a in enumerate(frames):
    m = a.astype(float)
    tot = m.sum() or 1
    yy, xx = np.indices(m.shape)
    cms.append(((xx * m).sum() / tot, (yy * m).sum() / tot))
    if i:
        changes.append(float(np.abs(a - frames[i - 1]).mean()))
changed = [start + i + 1 for i, c in enumerate(changes) if c > 0.05]
gaps = np.diff([start] + changed)
drift = max(np.hypot(cms[i][0] - cms[i - 1][0], cms[i][1] - cms[i - 1][1]) for i in range(1, len(cms)))
print(f"{label}: frames that change {changed}")
print(f"{label}: longest still run = {gaps.max() if len(gaps) else 'n/a'} frames; mean |diff| per step = {np.mean(changes):.2f}; max centre-of-mass step = {drift:.1f}px")
