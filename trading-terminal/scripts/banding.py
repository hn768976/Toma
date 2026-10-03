#!/usr/bin/env python3
"""Step 3: banding check on a frame decoded from the *encoded* mp4.

Extracts a frame, takes a horizontal and vertical line of pixels through a
blurred dark region, and reports the luma profile: the largest jump between
neighbouring pixels after smoothing out grain, and the longest run of
identical smoothed values (long flat runs followed by 1-level steps = bands).
Usage: scripts/banding.py out/X.mp4 frame x0 y0 x1 y1
"""
import subprocess, sys

def frame_rgb(path, n, w=1280, h=720):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", f"select=eq(n\\,{n})", "-vframes", "1",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return raw, w, h

def luma(raw, w, x, y):
    i = (y * w + x) * 3
    r, g, b = raw[i], raw[i + 1], raw[i + 2]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

path, n, x0, y0, x1, y1 = sys.argv[1], int(sys.argv[2]), *map(int, sys.argv[3:7])
raw, w, h = frame_rgb(path, n)
steps = max(abs(x1 - x0), abs(y1 - y0))
vals = [luma(raw, w, round(x0 + (x1 - x0) * k / steps), round(y0 + (y1 - y0) * k / steps)) for k in range(steps + 1)]
# Smooth over 9 px to remove grain, then look at the profile.
sm = [sum(vals[max(0, i - 4): i + 5]) / len(vals[max(0, i - 4): i + 5]) for i in range(len(vals))]
jumps = [abs(sm[i + 1] - sm[i]) for i in range(len(sm) - 1)]
q = [round(v) for v in sm]
run, best = 1, 1
for i in range(1, len(q)):
    run = run + 1 if q[i] == q[i - 1] else 1
    best = max(best, run)
print(f"{path} frame {n}: luma {min(vals):.1f}..{max(vals):.1f}, raw px-to-px sd "
      f"{(sum((vals[i+1]-vals[i])**2 for i in range(len(vals)-1))/(len(vals)-1))**0.5:.2f}, "
      f"max smoothed step {max(jumps):.2f}, longest flat run {best}px")
print("profile (every 16px):", " ".join(f"{v:.1f}" for v in sm[::16]))
