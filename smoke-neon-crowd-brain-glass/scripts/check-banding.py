#!/usr/bin/env python3
"""Step 4: read pixel values from frames decoded out of the ENCODED mp4s and
measure how smoothly they change across gradients and glows.

For each sample line we report the luma profile (smoothed over 9 px to remove
grain) and the longest run of identical smoothed values + the largest single
step. A banded gradient shows long flat runs separated by jumps; a dithered
one changes smoothly."""
import subprocess, sys, numpy as np
from PIL import Image

CHECKS = {
    # name: (mp4, time s, list of (x0,y0,x1,y1) lines in 1280x720 pixels)
    "GlitterSmoke_Blue": ("out/previews/GlitterSmoke_Blue.mp4", 5.0, [(0, 600, 700, 600), (100, 150, 1000, 150)]),
    "NeonPolygonFrame": ("out/previews/NeonPolygonFrame.mp4", 5.0, [(640, 0, 640, 719), (0, 360, 1279, 360)]),
    "CrowdSpotlight_Blue": ("out/previews/CrowdSpotlight_Blue.mp4", 11.0, [(640, 0, 640, 719), (300, 200, 980, 200)]),
    "GlassTwist_IceBlue": ("out/previews/GlassTwist_IceBlue.mp4", 10.0, [(0, 30, 1279, 30), (640, 0, 640, 719)]),
}

def frame(mp4, t):
    out = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", mp4, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True, check=True).stdout
    from io import BytesIO
    return np.asarray(Image.open(BytesIO(out)).convert("RGB")).astype(np.float64)

def line(img, x0, y0, x1, y1):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    xs = np.linspace(x0, x1, n).round().astype(int)
    ys = np.linspace(y0, y1, n).round().astype(int)
    rgb = img[ys, xs]
    return rgb @ np.array([0.2126, 0.7152, 0.0722])

for name, (mp4, t, lines) in CHECKS.items():
    img = frame(mp4, t)
    print(f"== {name} @ {t}s")
    for (x0, y0, x1, y1) in lines:
        y = line(img, x0, y0, x1, y1)
        k = np.ones(9) / 9
        s = np.convolve(y, k, mode="valid")
        q = np.round(s)
        runs, cur = [], 1
        for i in range(1, len(q)):
            if q[i] == q[i - 1]:
                cur += 1
            else:
                runs.append(cur); cur = 1
        runs.append(cur)
        steps = np.abs(np.diff(s))
        print(f"  line ({x0},{y0})-({x1},{y1}): luma {y.min():.0f}..{y.max():.0f}, "
              f"max smoothed step {steps.max():.2f}/px, longest flat run {max(runs)} px, "
              f"sample: {' '.join(str(int(v)) for v in y[:: max(1, len(y)//16)])}")
