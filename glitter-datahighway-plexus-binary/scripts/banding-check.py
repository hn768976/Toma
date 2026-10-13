#!/usr/bin/env python3
"""Banding check on the *encoded* mp4 previews.

Grabs one frame from each preview with ffmpeg (decoded from the H.264
file, not the PNG frames), then inspects the gradient areas that band most
easily: the glow haze (Look 1), the sky above the horizon glow (Look 2), the
dark sky and DoF blur (Look 3), the navy gradient (Look 4) and the dark DoF
blur (Look 5).

For each region it reports:
  * the row profile (each row averaged across the region) and its largest
    step between adjacent rows, in 8-bit levels. A smooth gradient changes
    by well under 1 level per row; a band edge shows up as a jump of
    about 1 level after a flat run.
  * "flat 8x8 blocks": the share of 8x8 blocks whose pixels are all the same
    value although they are not clipped black (mean > 3). Without dither, a
    slow gradient is mostly flat blocks separated by 1-level steps; with
    the ±1/255 dither and grain, almost none are flat.
A region passes when the profile step is < 1.0 level and fewer than 5% of
its blocks are flat.

Usage: python3 scripts/banding-check.py [previews_dir] [time_seconds]
"""
import os
import subprocess
import sys

import numpy as np

# name: [(label, x0, y0, x1, y1)] in fractions of the 1280x720 frame
REGIONS = {
    "GlitterVortex_Gold": [("glow haze, top-right sky", 0.90, 0.00, 1.00, 0.16)],
    "GlitterVortex_Silver": [("glow haze, top-right sky", 0.90, 0.00, 1.00, 0.16)],
    "DataHighway_Multicolour": [("sky above horizon glow", 0.30, 0.00, 0.70, 0.42)],
    "PlexusLandscape_BlueAmber": [("dark sky to navy horizon", 0.10, 0.00, 0.90, 0.28)],
    "LowPolyPlexus_Blue": [("navy gradient", 0.36, 0.00, 0.64, 0.55)],
    "LowPolyPlexus_Violet": [("plum gradient", 0.36, 0.00, 0.64, 0.55)],
    "BinaryPlane_Blue": [("dark DoF blur, top-left", 0.00, 0.00, 0.10, 0.30)],
    "BinaryPlane_Green": [("dark DoF blur, top-left", 0.00, 0.00, 0.10, 0.30)],
}


def frame(path, t):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", str(t), "-i", path, "-frames:v", "1",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(720, 1280, 3).astype(float)


def check(img, x0, y0, x1, y1):
    H, W, _ = img.shape
    reg = img[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)]
    lum = reg @ np.array([0.2126, 0.7152, 0.0722])
    prof = lum.mean(axis=1)
    step = np.abs(np.diff(prof)).max()
    h, w = (lum.shape[0] // 8) * 8, (lum.shape[1] // 8) * 8
    blocks = reg[:h, :w].reshape(h // 8, 8, w // 8, 8, 3).transpose(0, 2, 1, 3, 4).reshape(-1, 64, 3)
    lit = blocks.mean(axis=(1, 2)) > 3
    flat = (blocks.std(axis=1).max(axis=1) == 0) & lit
    flat_pct = 100.0 * flat.sum() / max(1, lit.sum())
    return prof, step, flat_pct


def main(d, t):
    ok = True
    for name, regions in REGIONS.items():
        p = os.path.join(d, name + ".mp4")
        if not os.path.exists(p):
            continue
        img = frame(p, t)
        for label, *box in regions:
            prof, step, flat = check(img, *box)
            good = step < 1.0 and flat < 5.0
            ok &= good
            samples = " ".join(f"{v:5.1f}" for v in prof[:: max(1, len(prof) // 8)])
            print(f"{name:27s} {label:28s} rows {samples} | max row step {step:4.2f} | flat blocks {flat:4.1f}% | "
                  f"{'smooth' if good else 'BANDING?'}")
    return ok


if __name__ == "__main__":
    d = sys.argv[1] if len(sys.argv) > 1 else "out/previews"
    t = float(sys.argv[2]) if len(sys.argv) > 2 else 10.0
    sys.exit(0 if main(d, t) else 1)
