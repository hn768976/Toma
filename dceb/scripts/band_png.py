"""Same residual metric on the lossless PNG (before encoding) for reference."""
import sys
import numpy as np
from PIL import Image
img = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(float) @ np.array([0.2126, 0.7152, 0.0722])
for ln in sys.argv[2:]:
    x0, y0, x1, y1 = [int(v) for v in ln.split(",")]
    n = int(max(abs(x1 - x0), abs(y1 - y0)))
    prof = img[np.linspace(y0, y1, n).astype(int), np.linspace(x0, x1, n).astype(int)]
    sm = np.convolve(prof, np.ones(9) / 9, mode="valid")
    tr = np.convolve(sm, np.ones(31) / 31, mode="valid")
    print(f"  PNG line {ln}: max residual {np.abs(sm[15:-15] - tr).max():.2f}")
