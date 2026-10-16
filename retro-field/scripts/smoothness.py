#!/usr/bin/env python3
"""Step 6 helper: frame-to-frame change across a rendered PNG sequence.
Spikes (a step much larger than its neighbours) mean popping or stutter;
a steady series means motion is smooth. Also reports a horizon/centre band."""
import sys, glob
from PIL import Image, ImageChops, ImageStat
d = sys.argv[1]
band = tuple(map(int, sys.argv[2:6])) if len(sys.argv) > 5 else None
files = sorted(glob.glob(f"{d}/*.png"))
prev = None
whole, part = [], []
for f in files:
    im = Image.open(f).convert("RGB")
    if prev is not None:
        df = ImageChops.difference(im, prev)
        whole.append(sum(ImageStat.Stat(df).mean) / 3)
        if band:
            part.append(sum(ImageStat.Stat(df.crop(band)).mean) / 3)
    prev = im
def summ(v):
    m = sum(v) / len(v)
    return f"mean {m:.2f}  min {min(v):.2f}  max {max(v):.2f}  max/mean {max(v)/m:.2f}"
print(f"{d}: {len(files)} frames | whole: {summ(whole)}" + (f" | band: {summ(part)}" if band else ""))
