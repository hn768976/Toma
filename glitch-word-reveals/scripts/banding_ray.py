#!/usr/bin/env python3
"""Banding check, ray version: pixel values from the frame centre straight up
to the top edge, on an 80-px-wide strip (trimmed mean per row, so the thin
background glyphs don't dominate). Writes a plot and reports flat runs.
  python3 scripts/banding_ray.py frame200.png [control.png] plot.png"""
import sys
import numpy as np
from PIL import Image, ImageDraw

def ray(path):
    img = np.asarray(Image.open(path).convert("RGB")).astype(float)
    H, W = img.shape[:2]
    strip = img[: H // 2, W // 2 - 40 : W // 2 + 40, 2]  # blue carries the navy gradient
    lo = np.percentile(strip, 10, axis=1, keepdims=True)
    hi = np.percentile(strip, 60, axis=1, keepdims=True)
    m = np.where((strip >= lo) & (strip <= hi), strip, np.nan)
    return np.nanmean(m, axis=1)[::-1]  # centre -> top edge

def flat_runs(v, start):
    # longest run (px) over which the value moves < 0.15 levels, in the
    # plain-gradient zone (outer part of the ray, past the word and its glow)
    best = run = 0
    for k in range(start + 1, len(v)):
        if abs(v[k] - v[k - 1]) < 0.15 and abs(v[k] - v[k - run - 1 if run else k - 1]) < 0.5:
            run += 1
        else:
            run = 0
        best = max(best, run)
    return best

paths = sys.argv[1:-1]
out = sys.argv[-1]
rays = [ray(p) for p in paths]
img = Image.new("RGB", (1200, 260 * len(rays)), "white")
d = ImageDraw.Draw(img)
for i, (p, r) in enumerate(zip(paths, rays)):
    start = int(len(r) * 0.62)  # outer 38%: no word, no word glow
    seg = r[start:]
    lo, hi = seg.min() - 1, seg.max() + 1
    pts = [(10 + k * 1180 / len(seg), 260 * i + 240 - (v - lo) / (hi - lo) * 210) for k, v in enumerate(seg)]
    d.line(pts, fill=(0, 80, 200), width=2)
    fr = flat_runs(r, start)
    d.text((20, 260 * i + 8), f"{p}: outer 38% of ray, centre side at left. longest flat run {fr}px", fill="black")
    print(f"{p}\n  values every 12px (outer part): " + " ".join(f"{v:.1f}" for v in seg[::12]))
    print(f"  longest flat run: {fr}px")
img.save(out)
