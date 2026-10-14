#!/usr/bin/env python3
"""Banding check on a frame taken from the encoded mp4.

  banding.py frame.png y x0 x1 [h]
Averages an h-row strip (default 48) column by column, which removes the
grain and dither noise but keeps any quantisation steps. A smooth gradient
shows small, even differences between neighbouring columns; banding shows
flat runs separated by jumps of about one code value.
"""
import sys
from PIL import Image

img, y, x0, x1 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
h = int(sys.argv[5]) if len(sys.argv) > 5 else 48
im = Image.open(img).convert("L")
prof = []
for x in range(x0, x1):
    s = sum(im.getpixel((x, yy)) for yy in range(y, y + h))
    prof.append(s / h)
# smooth lightly over 4 columns
sm = [sum(prof[max(0, i - 2):i + 2]) / len(prof[max(0, i - 2):i + 2]) for i in range(len(prof))]
d = [sm[i + 1] - sm[i] for i in range(len(sm) - 1)]
mean_abs = sum(abs(v) for v in d) / len(d)
jumps = sum(1 for v in d if abs(v) > 0.5)
# flat runs: consecutive columns whose raw strip means round to the same code value
runs, cur = [], 1
for i in range(1, len(prof)):
    if round(prof[i]) == round(prof[i - 1]): cur += 1
    else: runs.append(cur); cur = 1
runs.append(cur)
print(f"{img.split('/')[-1]} y={y} x={x0}-{x1}: range {min(sm):.1f}-{max(sm):.1f}, mean |step| {mean_abs:.3f}, steps>0.5: {jumps}, longest same-code run {max(runs)} px")
print("profile (every 16 px):", " ".join(f"{prof[i]:.2f}" for i in range(0, len(prof), 16)))
