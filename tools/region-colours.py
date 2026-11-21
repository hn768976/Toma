#!/usr/bin/env python3
"""Mean paint colour (brightest 60% of pixels, i.e. without ink) of named regions: reference vs attempt.
usage: tools/region-colours.py <ref.png> <attempt.png> name:x0,y0,x1,y1 [...]   (pixels at 898x506)"""
import colorsys, sys
import numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert("RGB").resize((898, 506), Image.BOX)).astype(float)
b = np.asarray(Image.open(sys.argv[2]).convert("RGB").resize((898, 506), Image.BOX)).astype(float)
def paint(c):
    l = c @ np.array([0.2126, 0.7152, 0.0722]); p = c[l >= np.percentile(l, 40)].mean(0)
    h, s, _ = colorsys.rgb_to_hsv(*(p / 255)); return "(%3d,%3d,%3d) hue %3.0f sat %.2f" % (p[0], p[1], p[2], h * 360, s)
for spec in sys.argv[3:]:
    n, r = spec.split(":"); x0, y0, x1, y1 = [int(v) for v in r.split(",")]
    print(f"{n:18s} ref {paint(a[y0:y1, x0:x1].reshape(-1, 3))}   attempt {paint(b[y0:y1, x0:x1].reshape(-1, 3))}")
