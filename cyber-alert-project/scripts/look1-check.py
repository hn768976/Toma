#!/usr/bin/env python3
"""Step 7, look 1: triangle brightness per frame (pulse) and triangle vs rest of frame."""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
OUT = Path(__file__).resolve().parent.parent / "out" / "verify"
for c in sys.argv[1:]:
    vals = []
    for n in [0, 150, 300, 450, 599]:
        a = np.asarray(Image.open(OUT / f"{c}_f{n}.png").convert("RGB")).astype(float)
        R, G, B = a[..., 0], a[..., 1], a[..., 2]
        lum = 0.2126 * R + 0.7152 * G + 0.0722 * B
        warm = (R > G * 1.5) & (R > B * 1.5)          # triangle hue (red/amber), not the blue/teal board
        tri = np.zeros_like(warm); tri[150:560, 600:1320] = True
        w = warm & tri
        tri_energy = (R + G + B)[w].sum() / 1e6       # total triangle light
        tri_peak = np.percentile(lum[w], 99) if w.any() else 0
        rest = lum.copy(); rest[150:780, 600:1320] = 0
        box = lum[150:560, 600:1320]
        vals.append(tri_energy)
        print(f"{c} f{n}: triangle light {tri_energy:.2f}M, triangle-box max luma {box.max():.0f} (p99.5 {np.percentile(box, 99.5):.0f}), rest-of-frame max {rest.max():.0f} (p99.9 {np.percentile(rest, 99.9):.0f})")
    print(f"{c}: triangle light range {min(vals):.2f}-{max(vals):.2f}M (spread {100*(max(vals)-min(vals))/max(vals):.0f}%)")
