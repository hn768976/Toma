"""Mean absolute pixel step across the loop seam (599 -> 600) vs. an ordinary
step (0 -> 1). A seamless loop gives similar numbers."""
import sys
import numpy as np
from PIL import Image

def load(p):
    return np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)

f599, f600, f0, f1 = (load(p) for p in sys.argv[1:5])
seam = np.abs(f600 - f599).mean()
normal = np.abs(f1 - f0).mean()
print(f"seam step 599->600: {seam:.3f}  ordinary step 0->1: {normal:.3f}  ratio {seam / max(normal, 1e-6):.2f}")
