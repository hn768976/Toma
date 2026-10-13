"""Banding probe: luminance profiles across the gradient areas of a frame decoded from the mp4.

Each profile is averaged over a 16-px strip (to see the gradient through the grain).
A banded gradient shows as a staircase: long flat runs separated by jumps. We print the
profile at intervals plus the largest row-to-row jump and the longest flat run.
"""
import sys
import numpy as np
from PIL import Image

REGIONS = {
    "TriangleRelief": [("left wall, vertical", "v", 40, 0, 720), ("dark top band, horizontal", "h", 20, 0, 640)],
    "IsoCloudChip": [("board gradient, vertical", "v", 60, 0, 720), ("board, horizontal", "h", 640, 0, 640)],
    "AIBrainChip": [("background haze, vertical", "v", 20, 0, 720), ("top haze, horizontal", "h", 20, 0, 1280)],
    "CircuitHorizon": [("sky to horizon glow, vertical", "v", 200, 0, 330), ("horizon glow, horizontal", "h", 228, 0, 1280)],
    "NeonPodium": [("sky, vertical", "v", 640, 0, 140), ("floor, vertical", "v", 60, 600, 720)],
}

img = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float64)
lum = img @ np.array([0.2126, 0.7152, 0.0722])
key = next(k for k in REGIONS if sys.argv[2].startswith(k))
for name, axis, pos, a, b in REGIONS[key]:
    if axis == "v":
        prof = lum[a:b, pos:pos + 16].mean(axis=1)
    else:
        prof = lum[pos:pos + 16, a:b].mean(axis=0)
    d = np.abs(np.diff(prof))
    # Longest run where the strip average stays within 0.05 of the run start (staircase plateau).
    longest, run, ref = 1, 1, prof[0]
    for v in prof[1:]:
        if abs(v - ref) < 0.05:
            run += 1
            longest = max(longest, run)
        else:
            run, ref = 1, v
    samples = " ".join(f"{v:.1f}" for v in prof[:: max(1, len(prof) // 12)])
    print(f"step4 {name}: range {prof.min():.1f}-{prof.max():.1f}, max row-to-row step {d.max():.2f}, longest flat run {longest}px | {samples}")
