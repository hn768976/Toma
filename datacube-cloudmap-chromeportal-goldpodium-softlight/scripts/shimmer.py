"""Persistent shimmer: share of pixels with >=3 large (>24 level) up/down reversals inside
any 11-frame window of the encoded preview. A thin feature merely passing over a
pixel gives one reversal; strobing/moiré gives many."""
import sys, subprocess, numpy as np
name, start, count = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
cmd = ["ffmpeg", "-v", "error", "-i", f"out/previews/{name}.mp4", "-vf", f"select=between(n\\,{start}\\,{start+count-1})",
       "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "gray", "-"]
f = np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.uint8).reshape(-1, 720, 1280).astype(np.int16)
a = f[1:-1] - f[:-2]; b = f[2:] - f[1:-1]
r = ((a * b < 0) & (np.abs(a) > 24) & (np.abs(b) > 24)).astype(np.int32)
worst = 0.0
for s in range(0, len(r) - 9, 3):
    worst = max(worst, (r[s:s + 9].sum(0) >= 3).mean() * 100)
print(f"{name} frames {start}-{start+len(f)-1}: worst 11-frame window persistent-shimmer pixels = {worst:.3f}%")
