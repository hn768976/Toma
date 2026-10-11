"""Motion + banding analysis on a verify.sh sequence (frames 270-329, 720p).

motion:  mean |f[t]-f[t-1]| (overall change per frame) and the temporal 2nd difference
         |f[t+1]-2f[t]+f[t-1]| (strobing/flicker: high when values jump back and forth).
banding: the sequence is encoded to H.264 (yuv420p, CRF 16) exactly like a delivery render,
         frame 300 is decoded back, and luminance profiles across given regions are tested
         for flat steps: the longest run of identical 8-bit values along a smooth ramp.
Usage: python3 -I scripts/analyze.py <seqdir> <region>... where region = name:x0,y0,x1,y1:axis
"""
import subprocess, sys, tempfile, os, glob
import numpy as np
from PIL import Image

seq = sys.argv[1]
frames = sorted(glob.glob(os.path.join(seq, "*.png")))
F = [np.asarray(Image.open(f).convert("RGB")).astype(np.float32) for f in frames]
d1 = [np.abs(F[i] - F[i - 1]).mean() for i in range(1, len(F))]
d2 = [np.abs(F[i + 1] - 2 * F[i] + F[i - 1]).mean() for i in range(1, len(F) - 1)]
print(f"motion: mean|dF|={np.mean(d1):.2f} max|dF|={np.max(d1):.2f} "
      f"mean|d2F|={np.mean(d2):.2f} (ratio d2/d1={np.mean(d2)/max(np.mean(d1),1e-6):.2f}; "
      f"~1.4 = smooth noise-like change, >>2 = strobing)")

with tempfile.TemporaryDirectory() as td:
    mp4 = os.path.join(td, "s.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "30", "-pattern_type", "glob",
                    "-i", os.path.join(seq, "*.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    "-crf", "16", mp4], check=True)
    out = os.path.join(td, "f.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", "select=eq(n\\,30)",
                    "-frames:v", "1", out], check=True)
    D = np.asarray(Image.open(out).convert("RGB")).astype(np.float32)

for spec in sys.argv[2:]:
    name, box, axis = spec.split(":")
    x0, y0, x1, y1 = map(int, box.split(","))
    reg = D[y0:y1, x0:x1].mean(2)
    prof = reg.mean(0) if axis == "x" else reg.mean(1)   # average across the other axis
    raw = reg[reg.shape[0] // 2] if axis == "x" else reg[:, reg.shape[1] // 2]
    q = np.round(raw).astype(int)
    runs, cur = [], 1
    for i in range(1, len(q)):
        if q[i] == q[i - 1]:
            cur += 1
        else:
            runs.append(cur); cur = 1
    runs.append(cur)
    steps = np.abs(np.diff(prof))
    print(f"banding {name}: range {prof.min():.1f}..{prof.max():.1f}, longest identical run on a "
          f"single line {max(runs)} px, max step of the averaged profile {steps.max():.2f}")
