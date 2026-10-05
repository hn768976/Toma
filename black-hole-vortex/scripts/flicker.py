# dev helper (step 6): temporal 2nd difference of frames 299/300/301 after a
# 5x5 box blur (removes grain). Smooth motion -> small 2nd difference.
import sys
import numpy as np
from PIL import Image
d = sys.argv[1]
for c in sys.argv[2:]:
    f = [np.asarray(Image.open(f"{d}/{c}_{i}.png").convert("L")).astype(float) for i in (299, 300, 301)]
    def blur(a, k=5):
        s = np.cumsum(np.cumsum(np.pad(a, ((k, 0), (k, 0))), 0), 1)
        return (s[k:, k:] - s[:-k, k:] - s[k:, :-k] + s[:-k, :-k]) / k / k
    b = [blur(x) for x in f]
    d1 = np.abs(b[1] - b[0]); acc = np.abs(b[2] - 2 * b[1] + b[0])
    print(f"{c:24s} motion mean={d1.mean():.2f}  flicker mean={acc.mean():.2f} p99.9={np.percentile(acc, 99.9):.1f}")
