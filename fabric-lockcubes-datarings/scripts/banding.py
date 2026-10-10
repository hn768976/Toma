"""Banding check on a rendered PNG: sample a horizontal and a vertical line
through a region, average across a 9-px band (removes grain, keeps steps),
and report the profile plus the largest step between neighbouring pixels.
A banded gradient shows flat runs separated by 1-LSB jumps; a dithered one
changes smoothly (fractional averages, no long flat runs).
usage: python3 -I scripts/banding.py file.png x0 y0 x1 y1 [label]"""
import sys
from PIL import Image
import numpy as np

f, x0, y0, x1, y1 = sys.argv[1], *map(int, sys.argv[2:6])
label = sys.argv[6] if len(sys.argv) > 6 else ""
a = np.asarray(Image.open(f).convert("RGB")).astype(float)
n = max(abs(x1 - x0), abs(y1 - y0))
xs = np.linspace(x0, x1, n).round().astype(int)
ys = np.linspace(y0, y1, n).round().astype(int)
prof = []
for x, y in zip(xs, ys):
    patch = a[max(y - 4, 0):y + 5, max(x - 4, 0):x + 5]
    prof.append(patch.mean(axis=(0, 1)))
prof = np.array(prof)
lum = prof @ np.array([0.2126, 0.7152, 0.0722])
raw = a[ys, xs] @ np.array([0.2126, 0.7152, 0.0722])
# Longest run of identical raw 8-bit luminance-ish values (green channel) -> plateau length
g = a[ys, xs, 1].astype(int)
runs, cur = [], 1
for i in range(1, len(g)):
    if g[i] == g[i - 1]:
        cur += 1
    else:
        runs.append(cur); cur = 1
runs.append(cur)
step = np.abs(np.diff(lum)).max()
print(f"{label} {f.split('/')[-1]} line ({x0},{y0})->({x1},{y1}): lum {lum[0]:.1f}->{lum[-1]:.1f}, "
      f"max step (9px-avg) {step:.2f}/255, longest flat run (raw G) {max(runs)} px, "
      f"distinct raw G values {len(set(g))}")
print("  profile every 1/8:", " ".join(f"{v:.1f}" for v in lum[:: max(1, n // 8)]))
