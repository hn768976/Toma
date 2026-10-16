"""Compare the loop seam (frame 599 -> frame 0) with the distribution of all
consecutive-frame steps of the full render (renders/frames/<id>)."""
import sys, os
import numpy as np
from PIL import Image
for id_ in sys.argv[1:]:
    d = f"renders/frames/{id_}"
    fs = sorted(os.listdir(d))
    prev = None
    steps = []
    first = None
    for f in fs[::1]:
        a = np.asarray(Image.open(os.path.join(d, f)).convert("RGB").resize((640, 360)), dtype=np.float32)
        if first is None: first = a
        if prev is not None: steps.append(np.abs(a - prev).mean())
        prev = a
    seam = np.abs(first - prev).mean()
    s = np.array(steps)
    pct = (s < seam).mean() * 100
    print(f"{id_}: seam 599->0 = {seam:.3f}; ordinary steps median {np.median(s):.3f}, p90 {np.percentile(s,90):.3f}, max {s.max():.3f}; seam is at the {pct:.0f}th percentile")
