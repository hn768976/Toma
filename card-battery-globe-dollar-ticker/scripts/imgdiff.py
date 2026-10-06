# Compare two PNGs: bounding box, max channel difference, count of differing pixels.
import sys
import numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(int)
b = np.asarray(Image.open(sys.argv[2]).convert("RGB")).astype(int)
d = np.abs(a - b).sum(2)
ys, xs = np.nonzero(d)
if len(ys) == 0:
    print("IDENTICAL")
else:
    print(f"differ: {len(ys)} px, max {np.abs(a-b).max()}, bbox x{xs.min()}-{xs.max()} y{ys.min()}-{ys.max()}")
