#!/usr/bin/env python3
"""Banding check on a frame decoded from the encoded mp4: walk vertical and
horizontal profiles through smooth dark regions (local gradient small) and report
the largest single-pixel step and the longest run of identical values."""
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
W, H = im.size
px = im.load()
lum = lambda p: 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]
worst_run, worst_step, samples = 0, 0, 0
for x in range(8, W, W // 16):
    col = [lum(px[x, y]) for y in range(H)]
    # smooth with a 9px box to separate gradient from grain
    sm = [sum(col[max(0, i - 4):i + 5]) / len(col[max(0, i - 4):i + 5]) for i in range(H)]
    run = 1
    for y in range(1, H):
        if sm[y] > 60:  # only dark regions
            run = 1
            continue
        samples += 1
        step = abs(sm[y] - sm[y - 1])
        worst_step = max(worst_step, step)
        raw = px[x, y] == px[x, y - 1]
        run = run + 1 if raw else 1
        worst_run = max(worst_run, run)
print(f"samples={samples} max_smoothed_step={worst_step:.2f} longest_identical_run_px={worst_run}")
