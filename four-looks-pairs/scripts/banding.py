#!/usr/bin/env python3
"""
Banding check on a frame extracted from the encoded mp4.
Grain is removed with a wide box blur; the remaining luminance profile along
rows/columns is then inspected for flat runs followed by jumps (steps).
A smooth gradient gives a profile whose first differences are small and
evenly spread; banding shows up as long runs of zero change ending in a
1-level step repeated many times (high "step score").

Usage: banding.py frame.png [frame2.png ...]
"""
import sys
from PIL import Image
import numpy as np

def box(a, r):
    k = 2 * r + 1
    c = np.cumsum(np.pad(a, ((r + 1, r), (r + 1, r)), mode="edge"), 0)
    c = c[k:] - c[:-k]
    c = np.cumsum(c, 1)
    c = c[:, k:] - c[:, :-k]
    return c / (k * k)

for path in sys.argv[1:]:
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(float)
    y = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    h, w = y.shape
    sm = box(y, 6)  # removes grain/dither, keeps gradients
    worst = 0.0
    report = []
    for name, prof in (("row", sm[h // 3, :]), ("row2", sm[2 * h // 3, :]), ("col", sm[:, w // 3]), ("col2", sm[:, 2 * w // 3])):
        d = np.diff(prof)
        # Quantised profile of the *raw* (unblurred) image's local mean in 16px steps
        q = np.round(prof)
        dq = np.diff(q)
        steps = np.flatnonzero(dq != 0)
        runs = np.diff(steps) if len(steps) > 1 else np.array([len(q)])
        # Max jump of the smoothed profile between adjacent pixels (in 8-bit levels)
        maxjump = float(np.max(np.abs(d)))
        report.append(f"{name}: range {prof.min():.1f}-{prof.max():.1f}, max adjacent jump {maxjump:.2f} lvl, longest flat run {int(runs.max()) if len(runs) else 0}px")
        worst = max(worst, maxjump)
    # raw-pixel histogram gaps in a mid-tone window (banding leaves missing levels)
    lv = np.bincount(np.round(y).astype(int).ravel(), minlength=256)
    lo, hi = np.percentile(y, 5), np.percentile(y, 95)
    win = lv[int(lo):int(hi) + 1]
    gaps = int((win == 0).sum())
    print(f"{path}\n  " + "\n  ".join(report) + f"\n  luma levels {int(lo)}-{int(hi)}: {gaps} empty levels"
          f"\n  => {'SMOOTH' if worst < 1.0 and gaps == 0 else 'CHECK'} (max smoothed step {worst:.2f} lvl)")
