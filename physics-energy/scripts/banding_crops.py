"""Contrast-stretched crops of smooth regions from frames decoded out of the mp4s.
Stretching (min..max -> 0..255) makes any 8-bit banding steps obvious.
Also prints, per crop, the luminance range and the longest constant run
in a 16-row-averaged profile."""
import sys
import numpy as np
from PIL import Image
D = sys.argv[1]
# name, (x0, y0, x1, y1) fractions, label
CROPS = [
    ("WindFarmHologram_Blue", (0.80, 0.02, 1.00, 0.30), "sky gradient top-right"),
    ("WindFarmHologram_Blue", (0.60, 0.30, 0.80, 0.60), "violet bloom"),
    ("WindFarmHologram_Green", (0.80, 0.02, 1.00, 0.30), "sky gradient top-right"),
    ("PrismDispersion_Dark", (0.20, 0.00, 0.45, 0.25), "incoming beam edge"),
    ("MagneticTorus_PinkViolet", (0.00, 0.00, 0.30, 0.20), "indigo background"),
    ("BarMagnets_Attract", (0.15, 0.55, 0.40, 0.80), "shadow / white surface"),
    ("ElectricField_OppositeCharges", (0.00, 0.30, 0.20, 0.70), "glow falloff on black"),
]
tiles = []
for name, (x0, y0, x1, y1), label in CROPS:
    a = np.asarray(Image.open(f"{D}/{name}_f150.png").convert("RGB")).astype(np.float64)
    H, W, _ = a.shape
    c = a[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)]
    L = c @ np.array([0.2126, 0.7152, 0.0722])
    lo, hi = np.percentile(L, 1), np.percentile(L, 99)
    s = np.clip((c - lo) / max(hi - lo, 1) * 255, 0, 255).astype(np.uint8)
    prof = L[: L.shape[0] // 16 * 16].reshape(-1, 16, L.shape[1]).mean(axis=1).mean(axis=1)
    r = np.round(prof, 1)
    run = best = 1
    for i in range(1, len(r)):
        run = run + 1 if r[i] == r[i - 1] else 1
        best = max(best, run)
    print(f"{name:32s} {label:26s} L range {lo:6.1f}-{hi:6.1f}  longest flat run (16-px rows) {best}")
    tiles.append(Image.fromarray(s).resize((320, 240), Image.NEAREST))
sheet = Image.new("RGB", (320 * 4, 240 * 2), (40, 40, 40))
for i, t in enumerate(tiles):
    sheet.paste(t, ((i % 4) * 320, (i // 4) * 240))
sheet.save(f"{D}/banding_stretched.png")
