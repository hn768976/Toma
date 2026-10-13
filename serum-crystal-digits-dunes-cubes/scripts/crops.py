#!/usr/bin/env python3
"""Zoomed crops of consecutive frames side by side (x2, nearest) to inspect shimmer.
usage: crops.py frames_dir out.png first count x0 y0 w h"""
import sys
from PIL import Image
d, out, f0, n, x, y, w, h = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:9])
tiles = [Image.open(f"{d}/element-{i:03d}.png").crop((x, y, x + w, y + h)).resize((w * 2, h * 2), Image.NEAREST) for i in range(f0, f0 + n)]
W = Image.new("RGB", (w * 2 * len(tiles), h * 2))
for i, t in enumerate(tiles): W.paste(t, (i * w * 2, 0))
W.save(out)
