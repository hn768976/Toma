#!/usr/bin/env python3
"""Step 4 — banding check on frames decoded from the ENCODED preview mp4s.

For a horizontal band across a gradient/glow we print:
  * the band profile averaged over 32 rows (every 16 px): a banded gradient
    shows integer plateaus with jumps; a dithered one moves in fractions;
  * the per-pixel noise (std of the high-pass) — dither+grain must be present;
  * the share of adjacent averaged samples that differ by exactly 0 or by >= 1
    whole code value with nothing in between ("staircase" score)."""
import os, subprocess, sys
from io import BytesIO
import numpy as np
from PIL import Image

CHECKS = {
    "GlitterSmoke_Blue": ("out/previews/GlitterSmoke_Blue.mp4", 5.0, [(560, 0, 1280), (200, 500, 1280)]),
    "NeonPolygonFrame": ("out/previews/NeonPolygonFrame.mp4", 5.0, [(300, 0, 1280), (420, 0, 1280)]),
    "CrowdSpotlight_Blue": ("out/previews/CrowdSpotlight_Blue.mp4", 11.0, [(120, 300, 980), (640, 300, 980)]),
    "GlassTwist_IceBlue": ("out/previews/GlassTwist_IceBlue.mp4", 10.0, [(16, 0, 1280), (700, 0, 1280)]),
}

def frame(mp4, t):
    png = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", mp4, "-frames:v", "1",
                          "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True, check=True).stdout
    return np.asarray(Image.open(BytesIO(png)).convert("RGB")).astype(np.float64)

only = sys.argv[1:]
for name, (mp4, t, bands) in CHECKS.items():
    if only and name not in only:
        continue
    if not os.path.exists(mp4):
        print("missing", mp4); continue
    img = frame(mp4, t)
    luma = img @ np.array([0.2126, 0.7152, 0.0722])
    print(f"== {name} @ {t}s (from encoded mp4)")
    for (y, x0, x1) in bands:
        band = luma[y:y + 32, x0:x1]
        prof = band.mean(axis=0)
        hp = band - np.convolve(prof, np.ones(9) / 9, mode="same")[None, :]
        noise = hp[:, 8:-8].std()
        p16 = prof[::16]
        d = np.abs(np.diff(p16))
        frac = ((d > 0.05) & (np.abs(d - np.round(d)) > 0.1)).mean()
        print(f"  rows {y}-{y+31}, x {x0}-{x1}: luma {prof.min():.1f}..{prof.max():.1f}, noise σ={noise:.2f} codes, "
              f"fractional steps {frac*100:.0f}%")
        print("   profile:", " ".join(f"{v:.1f}" for v in p16))
