#!/usr/bin/env python3
"""Banding check on the ENCODED mp4 (step 4 of the brief).

  python3 scripts/banding.py <OutName> <axis:row|col> <index> <start> <end>

Decodes frame 300 of renders/previews/<OutName>.mp4 to RGB, takes the luma
profile along one row or column of a gradient, and reports:
  * longest run of identical 8-bit values (banding = long flat plateaus)
  * largest step between neighbouring pixels after a 5-px box smooth
  * the 9-px smoothed profile itself (sampled), so steps are visible
"""
import subprocess, sys
import numpy as np
from PIL import Image

name, axis, idx, a, b = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
png = f"renders/verify/{name}/decoded_f300.png"
subprocess.run(
    f"mkdir -p renders/verify/{name} && ffmpeg -v error -y -i renders/previews/{name}.mp4 "
    f"-vf \"select=eq(n\\,300),scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24\" -frames:v 1 {png}",
    shell=True, check=True)
img = np.asarray(Image.open(png).convert("RGB")).astype(float)
lum = img @ np.array([0.2126, 0.7152, 0.0722])
line = lum[idx, a:b] if axis == "row" else lum[a:b, idx]
q = np.round(line).astype(int)
runs, cur = [], 1
for i in range(1, len(q)):
    if q[i] == q[i - 1]:
        cur += 1
    else:
        runs.append(cur)
        cur = 1
runs.append(cur)
sm5 = np.convolve(line, np.ones(5) / 5, mode="valid")
sm9 = np.convolve(line, np.ones(9) / 9, mode="valid")
print(f"{name} {axis} {idx} [{a}:{b}] range {line.min():.0f}-{line.max():.0f}  "
      f"longest flat run {max(runs)} px  max step (5px smooth) {np.abs(np.diff(sm5)).max():.2f}")
print("  profile (9px smooth, every 16px):", " ".join(f"{v:.1f}" for v in sm9[::16]))
