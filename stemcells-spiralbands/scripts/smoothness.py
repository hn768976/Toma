#!/usr/bin/env python3
"""Motion smoothness: mean absolute difference between consecutive frames
of a clip (decoded from the mp4). A pop, a seam or a focus jump shows as a
spike well above the neighbouring values.

  smoothness.py clip.mp4 start_s end_s
"""
import subprocess, sys
import numpy as np

clip, t0, t1 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
w, h = 640, 360
raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t0), "-to", str(t1), "-i", clip,
                      "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                     capture_output=True, check=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
d = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))
med = float(np.median(d))
ratio = d / max(med, 1e-6)
worst = int(np.argmax(ratio))
print(f"{clip.split('/')[-1]} {t0}-{t1}s: {len(frames)} frames, median diff {med:.3f}, "
      f"max {d.max():.3f} (x{ratio.max():.2f} median, at +{worst+1} frames), "
      f"spikes >2x median: {int((ratio > 2).sum())}")
