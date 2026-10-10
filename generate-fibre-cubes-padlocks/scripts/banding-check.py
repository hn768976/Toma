#!/usr/bin/env python3
"""Banding check on the *encoded* image.

Encodes a PNG still to H.264 yuv420p CRF 16 (as the deliverable would be),
decodes it back and prints pixel values along a line through a gradient, plus
the largest single step between neighbouring samples (in 8-bit levels).
usage: banding-check.py <png> <x0> <y0> <x1> <y1> [samples]
"""
import subprocess, sys, tempfile, os
from PIL import Image

png, x0, y0, x1, y1 = sys.argv[1], *map(int, sys.argv[2:6])
n = int(sys.argv[6]) if len(sys.argv) > 6 else 24
d = tempfile.mkdtemp()
mp4 = os.path.join(d, "f.mp4"); back = os.path.join(d, "f.png")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", png, "-frames:v", "3", "-r", "30",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", mp4], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-frames:v", "1", back], check=True)
im = Image.open(back).convert("RGB")
vals = []
for i in range(n + 1):
    x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
    # 5x5 mean so grain/dither does not dominate
    px = [im.getpixel((min(max(x + dx, 0), im.width - 1), min(max(y + dy, 0), im.height - 1)))
          for dx in range(-2, 3) for dy in range(-2, 3)]
    vals.append(tuple(round(sum(p[c] for p in px) / len(px), 1) for c in range(3)))
steps = [max(abs(a[c] - b[c]) for c in range(3)) for a, b in zip(vals, vals[1:])]
print(" ".join(f"{v[0]:.0f},{v[1]:.0f},{v[2]:.0f}" for v in vals))
print(f"max neighbour step {max(steps):.1f} levels, mean {sum(steps)/len(steps):.2f}")
