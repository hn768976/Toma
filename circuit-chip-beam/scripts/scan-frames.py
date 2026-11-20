#!/usr/bin/env python3
"""scan-frames.py VIDEO.mp4 - scan every frame for black frames, frozen runs and brightness jumps.
Decodes with ffmpeg to 320x180 grey frames. Prints a one-line verdict plus the measured extremes."""
import subprocess, sys
import numpy as np

path = sys.argv[1]
W, H = 320, 180
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}", "-pix_fmt", "gray", "-f", "rawvideo", "-"],
                     capture_output=True, check=True).stdout
n = len(raw) // (W * H)
f = np.frombuffer(raw, dtype=np.uint8)[: n * W * H].reshape(n, H, W).astype(np.float32) / 255
mean = f.mean(axis=(1, 2))
diff = np.abs(f[1:] - f[:-1]).mean(axis=(1, 2))
dmean = np.abs(np.diff(mean))
black = np.where(mean < 0.01)[0]
frozen = np.where(diff < 2e-4)[0]
# a jump = a change in mean brightness far above the local trend
jump = np.where(dmean > 0.04)[0]
# flicker = sign-alternating brightness changes
d = np.diff(mean); flick = np.where((d[1:] * d[:-1] < 0) & (np.abs(d[1:]) > 0.01) & (np.abs(d[:-1]) > 0.01))[0]
print(f"{path}: frames={n} mean_min={mean.min():.4f} mean_max={mean.max():.4f} "
      f"min_frame_diff={diff.min():.5f} max_frame_diff={diff.max():.4f} max_mean_step={dmean.max():.4f}")
print(f"  black frames: {len(black)}  frozen pairs: {len(frozen)}  brightness jumps: {len(jump)}  flicker points: {len(flick)}")
if len(black): print("   black at", black[:20])
if len(frozen): print("   frozen at", frozen[:20])
if len(jump): print("   jumps at", jump[:20])
if len(flick): print("   flicker at", flick[:20])
ok = not (len(black) or len(jump) or len(flick))
print("  VERDICT:", "PASS" if ok else "CHECK")
