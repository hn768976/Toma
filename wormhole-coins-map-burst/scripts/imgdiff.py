import sys
import numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(int)
b = np.asarray(Image.open(sys.argv[2]).convert("RGB")).astype(int)
d = np.abs(a - b)
label = sys.argv[3] if len(sys.argv) > 3 else ""
print(f"{label}: {'IDENTICAL' if d.max() == 0 else 'DIFFERENT'} max={d.max()} pixels_diff={(d.max(axis=2) > 0).sum()}")
