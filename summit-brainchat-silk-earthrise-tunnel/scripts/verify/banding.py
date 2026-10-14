#!/usr/bin/env python3
"""Banding check on a frame decoded from the ENCODED mp4.

For each named line segment (normalised coords), average a 24-px-wide band
perpendicular to the line, smooth lightly, and report the largest step
between neighbouring samples (in 8-bit code values). A banded gradient shows
staircase plateaus with whole-level jumps; a dithered one changes in small
fractional steps. Also writes a contrast-stretched crop for visual inspection.

usage: banding.py <frame.png> <outdir> <name> x0,y0,x1,y1[:label] ...
"""
import sys, os
import numpy as np
from PIL import Image

img_path, outdir, name = sys.argv[1:4]
im = np.asarray(Image.open(img_path).convert("RGB")).astype(np.float64)
H, W, _ = im.shape
lum = im @ np.array([0.2126, 0.7152, 0.0722])
os.makedirs(outdir, exist_ok=True)
ok_all = True
for spec in sys.argv[4:]:
    coords, _, label = spec.partition(":")
    x0, y0, x1, y1 = map(float, coords.split(","))
    p0 = np.array([x0 * (W - 1), y0 * (H - 1)])
    p1 = np.array([x1 * (W - 1), y1 * (H - 1)])
    L = int(np.linalg.norm(p1 - p0))
    d = (p1 - p0) / max(L, 1)
    n = np.array([-d[1], d[0]])
    prof = []
    for i in range(L):
        c = p0 + d * i
        vals = []
        for k in range(-12, 12):
            q = c + n * k
            xi, yi = int(round(q[0])), int(round(q[1]))
            if 0 <= xi < W and 0 <= yi < H:
                vals.append(lum[yi, xi])
        prof.append(np.mean(vals))
    prof = np.array(prof)
    sm = np.convolve(prof, np.ones(9) / 9, mode="valid")
    steps = np.abs(np.diff(sm))
    maxstep = steps.max() if len(steps) else 0
    rng = (prof.min(), prof.max())
    # distinct raw code values along the centre line (more = smoother)
    raw = [int(lum[int(round((p0 + d * i)[1])), int(round((p0 + d * i)[0]))]) for i in range(L)]
    ok = maxstep < 1.5
    ok_all &= ok
    print(f"{name} [{label}] len={L}px lum {rng[0]:.1f}..{rng[1]:.1f}  max smoothed step={maxstep:.2f} levels  distinct raw values={len(set(raw))}  {'SMOOTH' if ok else 'STEP?'}")
    print("   profile (every 1/16):", " ".join(f"{v:.1f}" for v in sm[:: max(1, len(sm) // 16)]))
    # contrast-stretched crop around the line
    xa, xb = int(min(p0[0], p1[0])) - 40, int(max(p0[0], p1[0])) + 40
    ya, yb = int(min(p0[1], p1[1])) - 40, int(max(p0[1], p1[1])) + 40
    xa, ya = max(xa, 0), max(ya, 0)
    crop = im[ya:yb, xa:xb]
    lo, hi = np.percentile(crop, 1), np.percentile(crop, 99)
    st = np.clip((crop - lo) / max(hi - lo, 1) * 255, 0, 255).astype(np.uint8)
    Image.fromarray(st).save(os.path.join(outdir, f"{name}_{label}_stretched.png"))
print("RESULT", name, "PASS" if ok_all else "CHECK")
