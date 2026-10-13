#!/usr/bin/env python3
"""Banding check on the *encoded* mp4.

Extracts one frame from each preview with ffmpeg, then walks vertical and
horizontal pixel transects through the gradient areas named in the README
(glow haze, horizon glow, navy gradient, dark DoF blur). For each transect it
smooths away grain/dither with a wide box filter and reports:
  * max step between adjacent smoothed samples (8-bit levels)
  * longest run of identical smoothed values (a long flat run followed by a
    step is what a band looks like)
Usage: python3 scripts/banding-check.py out/previews
"""
import subprocess, sys, os
import numpy as np

AREAS = {
    # name: list of (kind, fixed coord as fraction, start, end) on a 1280x720 frame
    "GlitterVortex_Gold": [("v", 0.85, 0.0, 0.35), ("h", 0.08, 0.55, 1.0)],
    "GlitterVortex_Silver": [("v", 0.85, 0.0, 0.35), ("h", 0.08, 0.55, 1.0)],
    "DataHighway_Multicolour": [("v", 0.5, 0.0, 0.5), ("v", 0.15, 0.0, 0.5)],
    "PlexusLandscape_BlueAmber": [("v", 0.5, 0.0, 0.45), ("v", 0.9, 0.0, 0.45)],
    "LowPolyPlexus_Blue": [("v", 0.5, 0.0, 0.6)],
    "LowPolyPlexus_Violet": [("v", 0.5, 0.0, 0.6)],
    "BinaryPlane_Blue": [("v", 0.12, 0.0, 0.4), ("h", 0.05, 0.0, 0.5)],
    "BinaryPlane_Green": [("v", 0.12, 0.0, 0.4), ("h", 0.05, 0.0, 0.5)],
}

def frame(path, t=10.0):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", path, "-frames:v", "1",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(720, 1280, 3).astype(float)

def transect(img, kind, fixed, a, b):
    H, W, _ = img.shape
    if kind == "v":
        x = int(fixed * (W - 1)); band = img[int(a * H):int(b * H), max(0, x - 3):x + 4].mean(axis=1)
    else:
        y = int(fixed * (H - 1)); band = img[max(0, y - 3):y + 4, int(a * W):int(b * W)].mean(axis=0)
    return band.mean(axis=1)  # luminance-ish

def main(d):
    ok = True
    for name, areas in AREAS.items():
        p = os.path.join(d, name + ".mp4")
        if not os.path.exists(p):
            continue
        img = frame(p)
        for kind, fixed, a, b in areas:
            t = transect(img, kind, fixed, a, b)
            k = 9
            sm = np.convolve(t, np.ones(k) / k, mode="valid")
            steps = np.abs(np.diff(sm))
            # a "band edge": a jump of >= 1.5 levels within one pixel in an otherwise smooth area
            maxstep = steps.max() if len(steps) else 0
            q = np.round(sm)
            runs, cur = [], 1
            for i in range(1, len(q)):
                cur = cur + 1 if q[i] == q[i - 1] else (runs.append(cur) or 1)
            runs.append(cur)
            verdict = "smooth" if maxstep < 1.5 else "CHECK"
            ok &= verdict == "smooth"
            print(f"{name:28s} {kind}@{fixed:.2f} [{a:.2f}-{b:.2f}] range {t.min():5.1f}-{t.max():5.1f}  "
                  f"max adjacent step {maxstep:4.2f}  longest flat run {max(runs):3d}px  {verdict}")
    return ok

if __name__ == "__main__":
    sys.exit(0 if main(sys.argv[1] if len(sys.argv) > 1 else "out/previews") else 1)
