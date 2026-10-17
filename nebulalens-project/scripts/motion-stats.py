#!/usr/bin/env python3
"""Step 6: mean absolute frame-to-frame difference over frames 285..345 (2 s
around frame 300) of the full render. Smooth motion gives a steady value;
flicker / boiling / popping shows up as spikes (max far above the median)."""
import sys, statistics
from PIL import Image, ImageChops, ImageStat
for name in sys.argv[1:]:
    d = []
    prev = Image.open(f"renders/seq/{name}/element-285.png").convert("L")
    for f in range(286, 346):
        cur = Image.open(f"renders/seq/{name}/element-{f:03d}.png").convert("L")
        d.append(ImageStat.Stat(ImageChops.difference(prev, cur)).mean[0])
        prev = cur
    med = statistics.median(d)
    print(f"{name:22s} median {med:6.3f}  min {min(d):6.3f}  max {max(d):6.3f}  max/median {max(d)/med:5.2f}")
