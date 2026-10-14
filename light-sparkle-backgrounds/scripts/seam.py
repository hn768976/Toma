"""Loop-seam continuity on lossless frames: the 599 -> 0 step must look like any other step.
(frame 600 == frame 0 by construction, so this is what catches a term that isn't whole-cycle.)"""
import sys, numpy as np
from PIL import Image
L = lambda p: np.array(Image.open(p).convert("RGB").resize((320, 180), Image.BILINEAR)).astype(float)
for id_ in sys.argv[1:]:
    d = f"out/frames/{id_}/"
    seam = np.abs(L(d + "f599.png") - L(d + "f000.png")).mean()
    steps = [np.abs(L(d + f"f{i:03d}.png") - L(d + f"f{i+1:03d}.png")).mean() for i in range(270, 330)]
    print(f"{id_:28s} seam {seam:.3f}  typical {np.median(steps):.3f}  max-in-window {max(steps):.3f}  ratio {seam/np.median(steps):.2f}")
