#!/usr/bin/env python3
"""Step 7 helper: frame-to-frame mean difference over 2 s around a frame.
A jump or pop shows up as a spike well above the neighbouring values."""
import sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from checks import meandiff
import glob
d, centre = sys.argv[1], int(sys.argv[2])
fs = sorted(glob.glob(d + "/*.png"), key=lambda p: int(p.rsplit("-", 1)[1][:-4]))
vals = [meandiff(fs[i], fs[i + 1]) for i in range(centre - 30, centre + 30)]
m = sorted(vals)[len(vals) // 2]
print(f"{d}: median step {m:.2f}, max {max(vals):.2f} (ratio {max(vals)/m:.2f})")
