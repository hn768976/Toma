"""Read pixel values along a line in a frame and report the step pattern.

usage: banding.py image.png x0 y0 x1 y1 [n]
Prints sampled values (smoothed over a 9x9 box to remove grain) and the
largest step between neighbouring samples. A smooth gradient has small,
evenly distributed steps; banding shows as flat runs + jumps."""
import sys
from PIL import Image
import numpy as np
img = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float32)
x0, y0, x1, y1 = map(int, sys.argv[2:6])
n = int(sys.argv[6]) if len(sys.argv) > 6 else 24
H, W, _ = img.shape
vals = []
for t in np.linspace(0, 1, n):
    x = int(round(x0 + (x1 - x0) * t)); y = int(round(y0 + (y1 - y0) * t))
    patch = img[max(0, y - 4):min(H, y + 5), max(0, x - 4):min(W, x + 5)]
    vals.append(patch.reshape(-1, 3).mean(axis=0))
vals = np.array(vals)
steps = np.abs(np.diff(vals, axis=0)).max(axis=1)
print("samples (R,G,B):", " ".join(f"{int(v[0])},{int(v[1])},{int(v[2])}" for v in vals))
# raw (unsmoothed) row: count distinct-value runs to detect flat bands
xs = np.linspace(x0, x1, 400).round().astype(int); ys = np.linspace(y0, y1, 400).round().astype(int)
raw = img[ys.clip(0, H - 1), xs.clip(0, W - 1)].mean(axis=1)
print(f"max smoothed step={steps.max():.2f}  mean step={steps.mean():.2f}  raw-line std of 2nd diff={np.diff(raw, 2).std():.2f}")
