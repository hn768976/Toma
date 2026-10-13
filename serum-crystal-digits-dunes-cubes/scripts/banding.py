#!/usr/bin/env python3
"""Banding check on a frame decoded from the encoded mp4.

For each named horizontal/vertical line across a gradient region it prints the
8-bit values sampled across the full width (every 64 px), then measures:
  * longest run of identical consecutive values on the raw line (G channel);
  * residual of a 16-row averaged profile against a smooth (deg-6) fit,
    in 8-bit levels. Visible banding shows up as a staircase: long identical
    runs AND a sawtooth residual of ~0.5 level with long period.
usage: banding.py frame.png name:axis:pos:start:end [...]
  axis = row|col, pos = fraction of height/width, start/end = fractions
"""
import sys
import numpy as np
from PIL import Image

img = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float64)
H, W, _ = img.shape
for spec in sys.argv[2:]:
    name, axis, pos, s0, s1 = spec.split(":")
    pos, s0, s1 = float(pos), float(s0), float(s1)
    if axis == "row":
        y = int(pos * (H - 1)); a, b = int(s0 * (W - 1)), int(s1 * (W - 1))
        band = img[max(0, y - 8):y + 8, a:b]
        line = img[y, a:b]
        prof = band.mean(axis=0)
    else:
        x = int(pos * (W - 1)); a, b = int(s0 * (H - 1)), int(s1 * (H - 1))
        band = img[a:b, max(0, x - 8):x + 8]
        line = img[a:b, x]
        prof = band.mean(axis=1)
    g = line[:, 1]
    runs, cur = [], 1
    for i in range(1, len(g)):
        if g[i] == g[i - 1]:
            cur += 1
        else:
            runs.append(cur); cur = 1
    runs.append(cur)
    t = np.linspace(-1, 1, len(prof))
    res = []
    for c in range(3):
        fit = np.polyval(np.polyfit(t, prof[:, c], 6), t)
        res.append(np.abs(prof[:, c] - fit).max())
    samples = " ".join(f"{int(v[0])},{int(v[1])},{int(v[2])}" for v in line[:: max(1, len(line) // 20)])
    step_max = np.abs(np.diff(prof[:, 1])).max()
    print(f"[{name}] {axis}@{pos:.2f} {s0:.2f}-{s1:.2f}: longest identical run={max(runs)}px  "
          f"max residual vs smooth fit={max(res):.2f} levels  max step of averaged profile={step_max:.2f}")
    print(f"   samples(R,G,B): {samples}")
