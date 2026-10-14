#!/usr/bin/env python3
"""Pixel comparison helpers for the verify loop.

  compare.py same A.png B.png          -> byte/pixel identity of two PNGs
  compare.py band IMG x0 y0 x1 y1 N    -> sample N pixels along a line, report
                                          the largest step between neighbours
                                          and the luminance profile
"""
import sys
from PIL import Image, ImageChops

def same(a, b):
    ia, ib = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    if ia.size != ib.size:
        print("DIFFERENT SIZE", ia.size, ib.size); return 1
    diff = ImageChops.difference(ia, ib)
    bbox = diff.getbbox()
    raw_same = open(a, "rb").read() == open(b, "rb").read()
    mx = max(diff.getextrema(), key=lambda e: e[1])[1]
    print(f"pixel-identical={bbox is None} file-bytes-identical={raw_same} max-channel-diff={mx}")
    return 0 if bbox is None else 1

def band(img, x0, y0, x1, y1, n):
    im = Image.open(img).convert("RGB")
    vals = []
    for i in range(n):
        t = i / (n - 1)
        x = round(x0 + (x1 - x0) * t); y = round(y0 + (y1 - y0) * t)
        # 3x3 mean so grain does not dominate
        acc = [0, 0, 0]
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                p = im.getpixel((min(max(x + dx, 0), im.width - 1), min(max(y + dy, 0), im.height - 1)))
                for c in range(3): acc[c] += p[c]
        vals.append([v / 9 for v in acc])
    lum = [0.299 * r + 0.587 * g + 0.114 * b for r, g, b in vals]
    steps = [abs(lum[i + 1] - lum[i]) for i in range(n - 1)]
    # flat runs: identical 3x3 means over several samples indicate quantisation plateaus
    flat = max_run = 0
    for s in steps:
        flat = flat + 1 if s < 0.05 else 0
        max_run = max(max_run, flat)
    print(f"range {min(lum):.1f}-{max(lum):.1f}  max step {max(steps):.2f}  mean step {sum(steps)/len(steps):.2f}  longest flat run {max_run}")
    print(" ".join(f"{v:.1f}" for v in lum))
    return 0

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "same": sys.exit(same(sys.argv[2], sys.argv[3]))
    if cmd == "band": sys.exit(band(sys.argv[2], *map(int, sys.argv[3:7]), int(sys.argv[7])))
