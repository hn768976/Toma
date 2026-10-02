#!/usr/bin/env python3
"""
Banding check on frames extracted from the encoded mp4.

1. Block test. The frame is cut into 16x16 blocks; a plane is fitted to each block's raw
   luma and the residual standard deviation measured. A banded gradient leaves blocks that
   are flat runs of one or two code values (residual sd < 0.3 levels) next to blocks one
   level away. Dither/grain keeps the residual sd well above that. Reported: share of
   lit blocks that are "quantised flat".
2. Profile test. A grain-free profile (16 px box blur) along a line through a smooth
   background/gradient area; a banded gradient shows as a staircase (repeated jumps of
   ~1 level separated by flat runs), a smooth one changes by fractions of a level per pixel.

Usage: banding.py frame.png [axis pos start end] ...   (axis = row|col)
"""
import sys
from PIL import Image
import numpy as np

def luma(path):
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(float)
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]

def block_test(y, b=16):
    h, w = (y.shape[0] // b) * b, (y.shape[1] // b) * b
    blocks = y[:h, :w].reshape(h // b, b, w // b, b).transpose(0, 2, 1, 3).reshape(-1, b * b)
    yy, xx = np.mgrid[0:b, 0:b]
    A = np.stack([np.ones(b * b), xx.ravel(), yy.ravel()], 1)
    coef, *_ = np.linalg.lstsq(A, blocks.T, rcond=None)
    resid = blocks - (A @ coef).T
    sd = resid.std(1)
    mean = blocks.mean(1)
    lit = (mean > 4) & (mean < 250)
    flat = lit & (sd < 0.3)
    return int(lit.sum()), int(flat.sum()), float(np.median(sd[lit])) if lit.any() else 0.0

def profile(y, axis, pos, a, z, r=8):
    if axis == "row":
        band = y[max(0, pos - r):pos + r + 1, :]
        p = band.mean(0)
    else:
        band = y[:, max(0, pos - r):pos + r + 1]
        p = band.mean(1)
    k = np.ones(2 * r + 1) / (2 * r + 1)
    p = np.convolve(np.pad(p, r, mode="edge"), k, mode="valid")[a:z]
    d = np.diff(p)
    return p, d

def staircase(p, flat=24, jump=0.8, w=18):
    """Jumps of >= `jump` levels over `w` px (the blur width) flanked on both sides by flat runs (a band edge)."""
    n = 0
    i = flat
    while i < len(p) - flat - w:
        if abs(p[i + w] - p[i]) >= jump:
            left = p[i - flat:i]
            right = p[i + w:i + w + flat]
            if np.ptp(left) < 0.3 and np.ptp(right) < 0.3:
                n += 1
                i += flat
                continue
        i += 1
    return n

args = sys.argv[1:]
ok_all = True
while args:
    path = args.pop(0)
    lines = []
    while len(args) >= 4 and args[0] in ("row", "col"):
        lines.append((args[0], int(args[1]), int(args[2]), int(args[3])))
        args = args[4:]
    y = luma(path)
    lit, flat, med = block_test(y)
    share = flat / max(1, lit)
    ok = share < 0.01
    print(f"{path}\n  blocks: {flat}/{lit} lit blocks quantised-flat ({100 * share:.2f}%), median residual sd {med:.2f} levels")
    for axis, pos, a, z in lines:
        p, d = profile(y, axis, pos, a, z)
        stair = staircase(p)
        print(f"  {axis} {pos} [{a}:{z}]: {p[0]:.1f} -> {p[-1]:.1f}, max slope {np.abs(d).max():.2f} lvl/px, "
              f"band edges (flat|jump|flat): {stair}; samples: " + " ".join(f"{v:.1f}" for v in p[::max(1, (z - a) // 12)]))
        ok = ok and stair == 0
    print(f"  => {'SMOOTH (no banding)' if ok else 'BANDING SUSPECTED'}")
    ok_all = ok_all and ok
sys.exit(0 if ok_all else 1)
