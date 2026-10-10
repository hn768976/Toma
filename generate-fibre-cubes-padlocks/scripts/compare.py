#!/usr/bin/env python3
"""Pixel-compare two PNGs. Exit 0 if identical, 1 otherwise."""
import sys
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert("RGB")
b = Image.open(sys.argv[2]).convert("RGB")
if a.size != b.size:
    print(f"DIFF size {a.size} vs {b.size}"); sys.exit(1)
d = ImageChops.difference(a, b)
bbox = d.getbbox()
if bbox is None:
    print("IDENTICAL"); sys.exit(0)
hist = d.convert("L").histogram()
n = sum(hist[1:])
print(f"DIFF pixels={n} maxdiff={max(i for i,v in enumerate(hist) if v)} bbox={bbox}"); sys.exit(1)
