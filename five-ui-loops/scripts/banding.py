"""Banding check on a frame decoded from the encoded mp4.
Usage: banding.py frame.png "x0,y0,x1,y1" [...]   (pixel coords)
For each segment: samples every pixel; reports
  - smoothed profile (7x7 box mean, removes grain) at 11 points,
  - largest step between neighbouring smoothed samples (8-bit levels),
  - longest run of identical raw luma values (a long flat run then a jump = band).
"""
import sys
import numpy as np
from PIL import Image

img = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float64)
H, W, _ = img.shape
luma = img @ np.array([0.2126, 0.7152, 0.0722])
pad = np.pad(img, ((3, 3), (3, 3), (0, 0)), mode="edge")
c = pad.cumsum(0).cumsum(1)
c = np.pad(c, ((1, 0), (1, 0), (0, 0)))
box = (c[7:, 7:] - c[:-7, 7:] - c[7:, :-7] + c[:-7, :-7]) / 49.0
ok = True
for seg in sys.argv[2:]:
    x0, y0, x1, y1 = map(float, seg.split(","))
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    xs = np.round(np.linspace(x0, x1, n)).astype(int)
    ys = np.round(np.linspace(y0, y1, n)).astype(int)
    prof = box[ys, xs]
    raw = np.round(luma[ys, xs]).astype(int)
    steps = np.abs(np.diff(prof, axis=0)).max()
    run = best = 1
    for a, b in zip(raw[:-1], raw[1:]):
        run = run + 1 if a == b else 1
        best = max(best, run)
    pts = [tuple(int(round(v)) for v in prof[i]) for i in np.linspace(0, n - 1, 11).astype(int)]
    verdict = "smooth" if steps <= 2.0 and best <= 24 else "CHECK"
    ok &= verdict == "smooth"
    print(f"  seg {seg}: max smoothed step {steps:.2f} lvl, longest flat raw run {best}px -> {verdict}")
    print(f"    profile RGB: {pts}")
print("RESULT:", "PASS" if ok else "FAIL")
