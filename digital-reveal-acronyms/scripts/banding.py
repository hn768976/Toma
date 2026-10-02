"""Banding check on a hold frame extracted from the ENCODED mp4.

Usage: python3 scripts/banding.py Reveal_CRM.mp4 [frame=450]

Reads pixel values on single rows from the frame centre out to the right
edge. Banding shows up as a staircase: long runs of one identical value, then
a jump. A dithered gradient changes every pixel or two.
"""
import subprocess, sys
import numpy as np
from PIL import Image

path = sys.argv[1]
frame = int(sys.argv[2]) if len(sys.argv) > 2 else 450
if path.endswith(".png"):
    png = path
else:
    png = path.rsplit(".", 1)[0] + f"_f{frame}_from_mp4.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-vf", f"select=eq(n\\,{frame})", "-frames:v", "1", png], check=True)
im = np.asarray(Image.open(png).convert("RGB")).astype(np.int32)
h, w, _ = im.shape
cy = h // 2
# Banding = the value along a line stays flat for long runs, then jumps a
# whole code value (a staircase). Measure runs of identical pixel values on
# single rows from the centre out to the edge, in every channel.
rows = [cy + int(h * f) for f in (0.20, 0.25, 0.30)]  # below the word
runs = []
for r in rows:
    for c in range(3):
        line = im[r, w // 2 :, c]
        n = 1
        for a, b in zip(line[:-1], line[1:]):
            if a == b:
                n += 1
            else:
                runs.append(n)
                n = 1
        runs.append(n)
runs = np.array(runs)
# Coarse profile (31px moving average, 3 rows) to show the smooth fall-off.
Y = (0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2])[rows].mean(axis=0)[w // 2 :]
sm = np.convolve(Y, np.ones(31) / 31, mode="valid")
print(f"{png}: rows {rows}, centre -> right edge ({w//2} px)")
print("profile every 60px (31px avg):", " ".join(f"{v:.1f}" for v in sm[::60]))
print(f"runs of identical values: mean {runs.mean():.2f} px, 99th pct {np.percentile(runs,99):.0f} px, max {runs.max()} px")
ok = runs.mean() < 3 and np.percentile(runs, 99) < 12
print("RESULT:", "PASS (smooth, no steps)" if ok else "FAIL (staircase / banding)")
sys.exit(0 if ok else 1)
