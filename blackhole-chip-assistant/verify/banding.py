"""
Banding check on a frame taken FROM THE ENCODED MP4.

Reads luminance along a straight line from (x0, y0) (the core) to (x1, y1)
(the frame edge), prints the values, and measures:
  * plateaus: runs of exactly-equal 8-bit values along the line. In a smooth,
    dithered gradient these stay short (a few pixels). Banding shows as long
    flat runs followed by a jump.
  * steps in the lightly smoothed profile: in a band edge the smoothed curve
    jumps by >= 1 level within a couple of pixels and is flat either side.
Usage: banding.py frame.png x0 y0 x1 y1
"""
import sys
import numpy as np
from PIL import Image

img = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float64)
x0, y0, x1, y1 = map(int, sys.argv[2:6])
n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
xs = np.linspace(x0, x1, n).round().astype(int)
ys = np.linspace(y0, y1, n).round().astype(int)
rgb = img[ys, xs]
lum = rgb @ np.array([0.2126, 0.7152, 0.0722])

# skip the clipped core (pure white) — banding lives in the falloff
start = int(np.argmax(lum < 250)) if (lum >= 250).any() else 0
seg = lum[start:]
segi = np.round(seg).astype(int)

# plateau lengths of identical luminance
# Runs at the black floor (<= 3) are flat because the signal itself is flat
# there (space), not banding, so they are not counted.
runs, cur = [], 1
for i in range(1, len(segi)):
    if segi[i] == segi[i - 1]:
        cur += 1
    else:
        if segi[i - 1] > 3:
            runs.append(cur)
        cur = 1
if segi[-1] > 3:
    runs.append(cur)
runs = np.array(runs) if runs else np.array([1])

# smoothed profile (9-px box, wide enough to average grain, narrow enough
# to keep a band edge) and its largest local jump vs the overall slope
k = 9
sm = np.convolve(seg, np.ones(k) / k, mode="valid")
d = np.abs(np.diff(sm))
slope = np.abs(sm[0] - sm[-1]) / max(len(sm), 1)

print(f"line ({x0},{y0}) -> ({x1},{y1}), {n} px, falloff starts at px {start}")
print("luminance every 40 px:", " ".join(f"{v:.0f}" for v in lum[::40]))
print("smoothed every 40 px :", " ".join(f"{v:.1f}" for v in sm[::40]))
print(f"identical-value runs: median {np.median(runs):.0f}, 99th pct {np.percentile(runs, 99):.0f}, max {runs.max()}")
print(f"smoothed profile: max per-px change {d.max():.3f} levels, mean slope {slope:.3f} levels/px")
# fail if the profile sits flat for long stretches (banding) — with dither
# and grain no run of identical values should exceed ~12 px in a gradient
bad = runs.max() > 24 or np.percentile(runs, 99) > 12
print("RESULT:", "BANDING SUSPECTED" if bad else "SMOOTH (no steps)")
sys.exit(1 if bad else 0)
