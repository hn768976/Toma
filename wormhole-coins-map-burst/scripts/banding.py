"""Banding probe on frames taken from the ENCODED mp4.
For a horizontal or vertical line through a glow/gradient, prints sampled values and two statistics:
 - longest run of identical luma values (long flat runs + 1-step jumps = visible banding)
 - largest jump of a 5-px moving-average luma profile between neighbouring pixels.
Usage: python3 banding.py frame.png x0 y0 x1 y1 [label]"""
import sys
import numpy as np
from PIL import Image
img = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(float)
x0, y0, x1, y1 = map(int, sys.argv[2:6])
label = sys.argv[6] if len(sys.argv) > 6 else ""
n = max(abs(x1 - x0), abs(y1 - y0)) + 1
xs = np.linspace(x0, x1, n).round().astype(int)
ys = np.linspace(y0, y1, n).round().astype(int)
rgb = img[ys, xs]
luma = (0.2126 * rgb[:, 0] + 0.7152 * rgb[:, 1] + 0.0722 * rgb[:, 2]).round().astype(int)
runs, cur = [], 1
for a, b in zip(luma[:-1], luma[1:]):
    if a == b:
        cur += 1
    else:
        runs.append(cur)
        cur = 1
runs.append(cur)
sm = np.convolve(luma, np.ones(5) / 5, mode="valid")
step = np.abs(np.diff(sm)).max() if len(sm) > 1 else 0
samples = " ".join(str(v) for v in luma[:: max(1, n // 16)])
print(f"{label}: n={n} luma range {luma.min()}-{luma.max()} | longest flat run {max(runs)} px | max smoothed step {step:.2f}")
print(f"   samples: {samples}")
