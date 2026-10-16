#!/usr/bin/env python3
"""Scan every frame of a preview for one-frame glitches: a frame b that
differs from both neighbours a and c much more than a differs from c."""
import subprocess, sys
import numpy as np
path = sys.argv[1]
W, H = 320, 180
raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32)
n = len(fr)
bad = []
for i in range(1, n - 1):
    ab = np.abs(fr[i] - fr[i - 1]).mean()
    bc = np.abs(fr[i + 1] - fr[i]).mean()
    ac = np.abs(fr[i + 1] - fr[i - 1]).mean()
    if min(ab, bc) > 1.6 * ac + 0.5:
        bad.append((i, round(ab, 2), round(bc, 2), round(ac, 2)))
# include the loop seam: 599 -> 0
steps = [np.abs(fr[(i + 1) % n] - fr[i]).mean() for i in range(n)]
print(f"{path}: {n} frames, one-frame glitches: {bad if bad else 'none'}; step mean {np.mean(steps):.2f} max {np.max(steps):.2f} (at {int(np.argmax(steps))}), seam 599->0 {steps[-1]:.2f}")
