#!/usr/bin/env python3
"""Step 4: banding check on a frame decoded from the ENCODED mp4.
Samples luma/RGB profiles (trimmed mean across a strip) and reports the step sizes.
usage: banding.py <mp4> <frame> <label> x0 y0 x1 y1 [strip=40]
  the profile runs from (x0,y0) to (x1,y1) (horizontal or vertical); the strip is averaged
  across the perpendicular direction with a trimmed mean (ignores sparkles/particles)."""
import subprocess, sys, tempfile, os
import numpy as np
from PIL import Image
mp4, frame, label = sys.argv[1], int(sys.argv[2]), sys.argv[3]
x0, y0, x1, y1 = map(int, sys.argv[4:8])
strip = int(sys.argv[8]) if len(sys.argv) > 8 else 40
with tempfile.TemporaryDirectory() as d:
    p = os.path.join(d, "f.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", f"select=eq(n\\,{frame})", "-frames:v", "1", p], check=True)
    a = np.asarray(Image.open(p).convert("RGB")).astype(float)
def trimmed(x, axis):
    s = np.sort(x, axis=axis)
    n = s.shape[axis]; lo, hi = n // 4, n - n // 4
    return np.take(s, range(lo, hi), axis=axis).mean(axis=axis)
if y0 == y1:   # horizontal profile
    ys = slice(max(0, y0 - strip // 2), y0 + strip // 2)
    prof = trimmed(a[ys, x0:x1, :], 0)
else:          # vertical profile
    xs = slice(max(0, x0 - strip // 2), x0 + strip // 2)
    prof = trimmed(a[y0:y1, xs, :], 1)
luma = prof @ np.array([0.299, 0.587, 0.114])
d = np.diff(luma)
print(f"== {label}  (frame {frame}, {len(luma)} samples)")
print("luma every 8th sample:", " ".join(f"{v:.1f}" for v in luma[::8]))
print(f"first-difference: max |step| = {np.abs(d).max():.2f} codes/px, "
      f"p95 = {np.percentile(np.abs(d), 95):.2f}")
# banding signature: a long monotone ramp sampled as plateaus. Count 'flat then jump' pairs.
ramp = np.abs(luma[-1] - luma[0]) > 6
flat = (np.abs(d) < 0.12).mean()
jumps = (np.abs(d) > 0.9).mean()
print(f"ramp {luma[0]:.1f} -> {luma[-1]:.1f}; flat fraction {flat:.2f}; jump(>0.9) fraction {jumps:.2f}"
      f"  => {'POSSIBLE BANDING' if (ramp and flat > 0.5 and jumps > 0.02) else 'smooth'}")
