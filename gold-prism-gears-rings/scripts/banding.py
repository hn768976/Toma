"""Banding check on frames decoded from the encoded mp4.

For each line given (row or column through a soft gradient) it reports:
  * the smoothed luma profile (16-px window means) — should change gradually,
  * the largest jump between neighbouring smoothed samples,
  * the longest run of identical raw 8-bit values (long flat runs that then
    jump are what banding looks like; with dither/grain runs stay short).
usage: python3 scripts/banding.py frame.png row:<y>|col:<x> [...]
"""
import sys
import numpy as np
from PIL import Image

img = np.asarray(Image.open(sys.argv[1]).convert("RGB"), dtype=np.float64)
luma = img @ np.array([0.2126, 0.7152, 0.0722])
for spec in sys.argv[2:]:
    kind, v = spec.split(":")
    v = int(v)
    if kind == "row":
        strip = luma[max(0, v - 4): v + 5, :].mean(axis=0)
        raw = np.round(img[v, :, 1]).astype(int)
    else:
        strip = luma[:, max(0, v - 4): v + 5].mean(axis=1)
        raw = np.round(img[:, v, 1]).astype(int)
    w = 16
    sm = strip[: len(strip) // w * w].reshape(-1, w).mean(axis=1)
    jumps = np.abs(np.diff(sm))
    run, best = 1, 1
    for a, b in zip(raw[:-1], raw[1:]):
        run = run + 1 if a == b else 1
        best = max(best, run)
    print(f"{spec}: smoothed profile (every 16px) = {' '.join(f'{x:.1f}' for x in sm[::2])}")
    print(f"{spec}: max neighbour jump = {jumps.max():.2f} levels, mean = {jumps.mean():.2f}; longest identical raw run = {best}px")
