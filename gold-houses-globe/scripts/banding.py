#!/usr/bin/env python3
"""Banding check on a decoded frame (PNG extracted from the encoded mp4).

For each probe line it reports
  - range of 8-bit luma along the line
  - longest run of identical raw values (banding shows up as long flat runs;
    dither + grain keep runs short)
  - largest jump in the band-averaged profile (average of a 17-px-wide strip
    across the line, so grain is removed but real steps would remain)
usage: banding.py frame.png "row:Y:X0:X1" "col:X:Y0:Y1" ...
"""
import sys
import numpy as np
from PIL import Image

img = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float64)
luma = img @ np.array([0.2126, 0.7152, 0.0722])
for spec in sys.argv[2:]:
    kind, a, b0, b1 = spec.split(":")
    a, b0, b1 = int(a), int(b0), int(b1)
    if kind == "row":
        raw = np.rint(luma[a, b0:b1]).astype(int)
        band = luma[max(0, a - 8):a + 9, b0:b1].mean(axis=0)
        rgb = img[a, b0:b1]
    else:
        raw = np.rint(luma[b0:b1, a]).astype(int)
        band = luma[b0:b1, max(0, a - 8):a + 9].mean(axis=1)
        rgb = img[b0:b1, a]
    runs, best, cur = [], 1, 1
    for i in range(1, len(raw)):
        cur = cur + 1 if raw[i] == raw[i - 1] else 1
        best = max(best, cur)
    # smooth the band profile lightly along the line, then look at steps
    k = np.ones(5) / 5
    sm = np.convolve(band, k, mode="valid")
    jumps = np.abs(np.diff(sm))
    prof = " ".join(f"{v:.1f}" for v in band[:: max(1, len(band) // 12)])
    print(f"{spec}: luma {raw.min()}..{raw.max()}  longest-flat-run {best}px  "
          f"max-step(avg) {jumps.max():.2f}  mean-step {jumps.mean():.3f}\n    profile: {prof}")
