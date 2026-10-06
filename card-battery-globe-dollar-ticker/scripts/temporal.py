# Temporal smoothness over 3 consecutive frames: fraction of pixels whose change
# 299→300 and 300→301 flips sign with a large magnitude (flicker / crawl), and the
# mean absolute change.
import sys
import numpy as np
from PIL import Image
f = [np.asarray(Image.open(p).convert("L")).astype(float) for p in sys.argv[1:4]]
d1 = f[1] - f[0]
d2 = f[2] - f[1]
flick = ((np.sign(d1) != np.sign(d2)) & (np.abs(d1) > 40) & (np.abs(d2) > 40)).mean()
print(f"  mean |Δ| 299→300 {np.abs(d1).mean():.2f}, 300→301 {np.abs(d2).mean():.2f}; strong flicker pixels {flick*100:.3f}%")
