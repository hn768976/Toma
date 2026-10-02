"""Whole-frame banding test (complements banding.py).
Finds every 32x32 tile that is a gentle gradient (7x7-smoothed luma changes by
1..16 levels across the tile, no edges) and checks the raw pixels there are
dithered: banding shows up as long runs of identical values (plateaus).
Also writes a contrast-stretched crop (x8 around the darkest glow levels) for eyeballing.
Usage: banding_tiles.py frame.png [crop x,y,w,h] [stretch_out.png]
"""
import sys
import numpy as np
from PIL import Image

img = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float64)
L = img @ np.array([0.2126, 0.7152, 0.0722])
H, W = L.shape
p = np.pad(L, 3, mode="edge")
c = np.pad(p.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
S = (c[7:, 7:] - c[:-7, 7:] - c[7:, :-7] + c[:-7, :-7]) / 49.0
gy, gx = np.gradient(S)
G = np.hypot(gx, gy)
Lr = np.round(L).astype(int)
T = 32
tiles = bad = 0
worst = 0
for y in range(0, H - T + 1, T):
    for x in range(0, W - T + 1, T):
        s = S[y:y + T, x:x + T]
        rng = s.max() - s.min()
        if not (1.0 <= rng <= 16.0) or G[y:y + T, x:x + T].max() > 1.5:
            continue
        if img[y:y + T, x:x + T].max(2).mean() >= 250:  # clipped highlight, not a gradient
            continue
        tiles += 1
        r = Lr[y:y + T, x:x + T]
        runs = 1
        for row in r:
            run = 1
            for a, b in zip(row[:-1], row[1:]):
                run = run + 1 if a == b else 1
                runs = max(runs, run)
        worst = max(worst, runs)
        if runs > 24:
            bad += 1
print(f"gentle-gradient tiles: {tiles}, tiles with plateau run >24px: {bad}, longest run: {worst}px")
print("RESULT:", "PASS" if tiles > 0 and bad == 0 else "FAIL")
if len(sys.argv) >= 4:
    x, y, w, h = map(int, sys.argv[2].split(","))
    crop = img[y:y + h, x:x + w]
    lo = np.percentile(crop, 1)
    st = np.clip((crop - lo) * 8, 0, 255).astype(np.uint8)
    Image.fromarray(st).resize((w * 2, h * 2), Image.NEAREST).save(sys.argv[3])
