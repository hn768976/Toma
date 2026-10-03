"""Seam check on an encoded preview: mean absolute difference of the wrap step
(frame 599 -> frame 0) compared with ordinary neighbouring steps."""
import subprocess, sys
import numpy as np
f = sys.argv[1]
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-vf", "scale=320:180", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                     capture_output=True, check=True).stdout
v = np.frombuffer(raw, np.uint8).reshape(-1, 180, 320, 3).astype(np.float32)
steps = np.abs(np.diff(v, axis=0)).mean(axis=(1, 2, 3))
wrap = np.abs(v[0] - v[-1]).mean()
print(f"{f.split('/')[-1]}: wrap step {wrap:.2f}, ordinary steps mean {steps.mean():.2f} (min {steps.min():.2f}, max {steps.max():.2f}) -> {'SEAMLESS' if wrap <= steps.max() * 1.05 else 'CHECK'}")
