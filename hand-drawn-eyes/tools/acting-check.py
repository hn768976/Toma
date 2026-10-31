#!/usr/bin/env python3
"""Acting check on a PNG sequence (720p): per frame, the visible eye-white
area of the left and right eye and the horizontal position of the dark
pupil/iris inside each eye. Reports blinks (closures), whether both eyes move
together, and the largest frame-to-frame jumps (pops).
usage: acting-check.py <seq_dir> <x0,y0,x1,y1 left eye box> <x0,y0,x1,y1 right eye box> <white_thr>"""
import sys
import numpy as np
from PIL import Image
d = sys.argv[1]
boxes = [tuple(map(int, b.split(","))) for b in sys.argv[2:4]]
thr = int(sys.argv[4])
areas, px = [[], []], [[], []]
for f in range(300):
    im = np.asarray(Image.open(f"{d}/element-{f:03d}.png").convert("RGB"), dtype=np.int16)
    for e, (x0, y0, x1, y1) in enumerate(boxes):
        c = im[y0:y1, x0:x1]
        lum = c.mean(axis=2)
        white = (lum > thr) & (np.abs(c[..., 0] - c[..., 2]) < 40)
        areas[e].append(int(white.sum()))
        # pupil/iris: saturated or dark pixels surrounded by eye area
        cols = np.nonzero(white.any(axis=0))[0]
        dark = (lum < 90) | (np.abs(c[..., 0] - c[..., 2]) > 60)
        if len(cols):
            dark[:, : cols[0]] = False
            dark[:, cols[-1] + 1 :] = False
        rows = np.nonzero(white.any(axis=1))[0]
        if len(rows):
            dark[: rows[0]] = False
            dark[rows[-1] + 1 :] = False
        ys, xs = np.nonzero(dark)
        px[e].append(float(xs.mean()) if len(xs) > 30 else np.nan)
a = np.array(areas, float)
med = np.median(a, axis=1, keepdims=True)
rel = a / med
closed = [f for f in range(300) if rel[0, f] < 0.08 and rel[1, f] < 0.08]
runs = []
for f in closed:
    if runs and f == runs[-1][1] + 1:
        runs[-1][1] = f
    else:
        runs.append([f, f])
print("blink closures (both eyes <8% open area):", [(a_, b_) for a_, b_ in runs])
print("min relative open area L/R:", rel[0].min().round(3), rel[1].min().round(3))
print("open area in step (corr L vs R):", np.corrcoef(rel[0], rel[1])[0, 1].round(3))
p = np.array(px, float)
ok = ~np.isnan(p).any(axis=0)
pl, pr = p[0][ok] - np.nanmedian(p[0]), p[1][ok] - np.nanmedian(p[1])
print("pupil x in step (corr L vs R):", np.corrcoef(pl, pr)[0, 1].round(3))
jumps = np.abs(np.diff(p, axis=1))
jumps[np.isnan(jumps)] = 0
order = np.argsort(-jumps.max(axis=0))[:5]
print("largest frame-to-frame pupil moves (px at 720p):", [(int(i) + 1, round(float(jumps[:, i].max()), 1)) for i in order])
dif = np.abs(np.diff(rel, axis=1)).max(axis=0)
print("largest frame-to-frame open-area changes:", [(int(i) + 1, round(float(dif[i]), 2)) for i in np.argsort(-dif)[:6]])
