#!/usr/bin/env python3
"""Banding check on an ENCODED mp4: decode one frame, then walk lines across
dark gradients / glow falloffs and report the largest step between
neighbouring (box-averaged) samples and the longest perfectly flat run.
Smooth gradients have small steps and short flat runs (dither + grain break
them up); banding shows as long flat runs separated by 1-code jumps that line
up into visible contours.
usage: banding.py <video.mp4> <time_s> <x0,y0,x1,y1> [<x0,y0,x1,y1> ...]
"""
import subprocess, sys
from PIL import Image
import io

video, t = sys.argv[1], sys.argv[2]
png = subprocess.run(["ffmpeg", "-v", "error", "-ss", t, "-i", video, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
                     capture_output=True, check=True).stdout
im = Image.open(io.BytesIO(png)).convert("RGB")
W, H = im.size
px = im.load()
for spec in sys.argv[3:]:
    x0, y0, x1, y1 = map(int, spec.split(","))
    n = max(abs(x1 - x0), abs(y1 - y0))
    raw, avg = [], []
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
        raw.append(sum(px[x, y]) / 3)
        # 9x9 box average: the underlying gradient without grain
        acc = 0; c = 0
        for dy in range(-4, 5):
            for dx in range(-4, 5):
                xx = min(W - 1, max(0, x + dx)); yy = min(H - 1, max(0, y + dy))
                acc += sum(px[xx, yy]) / 3; c += 1
        avg.append(acc / c)
    steps = [abs(avg[i + 1] - avg[i]) for i in range(n)]
    flat, best = 1, 1
    for i in range(n):
        flat = flat + 1 if round(raw[i + 1]) == round(raw[i]) else 1
        best = max(best, flat)
    print(f"{spec}: range {min(avg):.1f}-{max(avg):.1f}  max step (box avg) {max(steps):.2f}  "
          f"mean step {sum(steps)/n:.3f}  longest flat run (raw px) {best}")
