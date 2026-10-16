# Samples 50 points away from the timeline artwork; all must be 0,0,0 (+-1).
import sys
from PIL import Image
import numpy as np
img = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(int)
h, w, _ = img.shape
pts = []
import itertools
for i in range(50):
    x = int((i * 0.6180339887 % 1) * (w - 20)) + 10
    y = int((i * 0.7548776662 % 1) * (h - 20)) + 10
    # keep away from the band the timeline occupies (y 230..490 at 720p)
    if 225 * h / 720 < y < 495 * h / 720:
        y = int(y * 0.3) if y < h / 2 else int(h - (h - y) * 0.3)
    pts.append((x, y))
bad = [(x, y, tuple(img[y, x])) for x, y in pts if img[y, x].max() > 1]
print(f"sampled {len(pts)} points, max value {max(img[y, x].max() for x, y in pts)}, out-of-range {len(bad)}")
for b in bad: print("  ", b)
sys.exit(1 if bad else 0)
