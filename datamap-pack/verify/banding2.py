"""Step 4b: dither effectiveness on the encoded mp4 frame.
For each line: slope s (levels/px) of a 101-px smoothed copy; an undithered
8-bit gradient would sit on one value for ~1/s px (a band). We report, over
pixels where s > 0.02, the median expected band width vs the median run of
identical raw values actually present, and the 'mode share' (fraction of a
31-px window equal to its most common value; ~1.0 = flat band, low = mixed)."""
import numpy as np
from PIL import Image
from collections import Counter
import sys
sys.path.insert(0, 'verify')
from banding import LINES
from PIL import Image
def sample(im, a, b):
    (x0, y0), (x1, y1) = a, b
    n = max(abs(x1 - x0), abs(y1 - y0)) + 1
    return np.array([im.getpixel((round(x0 + (x1 - x0) * i / (n - 1)), round(y0 + (y1 - y0) * i / (n - 1)))) for i in range(n)], dtype=float)
for name in ["SoftGradient_Lime", "SoftGradient_Peach", "PlexusGlobe_Navy", "WirePeaks_White", "WirePeaks_Cyan"]:
    im = Image.open(f"out/verify/banding/{name}-300.png").convert("RGB")
    for label, a, b in LINES[name]:
        px = sample(im, a, b)
        out = []
        for c in range(3):
            v = px[:, c]
            k = np.ones(101) / 101
            sm = np.convolve(np.pad(v, 50, mode="edge"), k, mode="valid")
            s = np.abs(np.gradient(sm))
            runs = np.ones(len(v))
            for i in range(1, len(v)):
                if v[i] == v[i - 1]: runs[i] = runs[i - 1] + 1
            share = np.array([Counter(v[max(0, i - 15): i + 16]).most_common(1)[0][1] / len(v[max(0, i - 15): i + 16]) for i in range(len(v))])
            m = s > 0.02
            if m.sum() < 20:
                out.append(f"{'RGB'[c]}: flat (no slope)  modeshare {share.mean():.2f}")
                continue
            out.append(f"{'RGB'[c]}: band~{np.median(1 / s[m]):.0f}px run_med {np.median(runs[m]):.0f} modeshare {share[m].mean():.2f}")
        print(f"{name:20s} {label:14s} " + " | ".join(out))
