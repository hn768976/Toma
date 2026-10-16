# Samples pixel rows across gradients of a frame taken from the encoded mp4.
# Reports the longest run of identical values and the largest step between
# neighbouring samples along each line: smooth = small steps, no long flat runs
# that end in a jump.
import sys
from PIL import Image
import numpy as np
img = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(float)
lines = [tuple(map(int, s.split(","))) for s in sys.argv[2:]]  # x0,y0,x1,y1
for (x0, y0, x1, y1) in lines:
    n = int(max(abs(x1 - x0), abs(y1 - y0)))
    h, w = img.shape[:2]
    xs = np.clip(np.linspace(x0, x1, n).astype(int), 0, w - 1); ys = np.clip(np.linspace(y0, y1, n).astype(int), 0, h - 1)
    # 9x9 box average to look at the gradient, not the grain
    vals = np.array([img[max(0,y-4):y+5, max(0,x-4):x+5].reshape(-1, 3).mean(0) for x, y in zip(xs, ys)])
    lum = vals @ np.array([0.299, 0.587, 0.114])
    steps = np.abs(np.diff(lum))
    raw = img[ys, xs] @ np.array([0.299, 0.587, 0.114])
    print(f"line {x0},{y0}->{x1},{y1}: lum {lum.min():.1f}..{lum.max():.1f}  max step(avg) {steps.max():.2f}  mean step {steps.mean():.3f}  raw-std {np.std(np.diff(raw)):.2f}")
