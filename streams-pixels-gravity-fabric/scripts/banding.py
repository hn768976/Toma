#!/usr/bin/env python3
"""Step 4: decode a frame from the ENCODED mp4 and inspect dark gradients/glows.
For each region: luma range, residual noise (raw - 9x9 box blur) std in LSB.
Banding shows as residual ~0 with visible contour steps; dithered/grained
gradients keep residual noise >~0.5 LSB after H.264. Also writes a
contrast-stretched (x8 around the region mean) PNG for visual inspection.
usage: banding.py file.mp4 frame out_prefix"""
import subprocess, sys, numpy as np
from PIL import Image
f, n, pre = sys.argv[1], int(sys.argv[2]), sys.argv[3]
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-vf", f"select=eq(n\\,{n})", "-frames:v", "1",
                      "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
rgb = np.frombuffer(raw, np.uint8).reshape(720, 1280, 3).astype(float)
y = rgb @ [0.2126, 0.7152, 0.0722]
def box(a, k=9):
    p = np.pad(a, k // 2, mode="edge"); c = p.cumsum(0).cumsum(1)
    c = np.pad(c, ((1, 0), (1, 0)))
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)
res = y - box(y)
# pick the 6 darkest-but-not-black smooth 96x96 tiles (gradients/glow falloffs)
tiles = []
for ty in range(0, 720 - 96, 48):
    for tx in range(0, 1280 - 96, 48):
        t = y[ty:ty + 96, tx:tx + 96]; g = box(t, 15)
        rng = g.max() - g.min()
        if 4 < t.mean() < 90 and rng > 3 and np.abs(res[ty:ty+96, tx:tx+96]).mean() < 6:
            tiles.append((t.mean(), ty, tx, rng))
tiles.sort()
sel = tiles[:: max(1, len(tiles) // 6)][:6]
for m, ty, tx, rng in sel:
    r = res[ty:ty + 96, tx:tx + 96]
    print(f"tile ({tx},{ty}) mean luma {m:5.1f} gradient span {rng:4.1f}  residual noise std {r.std():.2f} LSB")
    crop = rgb[ty:ty + 96, tx:tx + 96]
    st = np.clip((crop - crop.mean()) * 8 + 128, 0, 255).astype(np.uint8)
    Image.fromarray(st).resize((192, 192), Image.NEAREST).save(f"{pre}_{tx}_{ty}.png")
