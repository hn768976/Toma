"""Banding check on frames decoded from the encoded mp4.
usage: python3 scripts/banding.py renders/X.mp4 frame "x0,y0,x1,y1" [...]
For each line it prints the luminance profile summary: the longest run of
identical raw values (long runs + 1-level jumps = banding) and the largest
step in a 9x9 box-averaged profile (should be well under 1 level/px)."""
import subprocess, sys
import numpy as np

def frame(mp4, n):
    w, h = 1280, 720
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vf", f"select=eq(n\\,{n})", "-frames:v", "1",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3).astype(np.float64)

mp4, n = sys.argv[1], int(sys.argv[2])
img = frame(mp4, n)
lum = img @ np.array([0.2126, 0.7152, 0.0722])
from numpy.lib.stride_tricks import sliding_window_view as swv
pad = np.pad(lum, 4, mode="edge")
box = swv(pad, (9, 9)).mean(axis=(2, 3))
for spec in sys.argv[3:]:
    x0, y0, x1, y1 = map(int, spec.split(","))
    L = int(max(abs(x1 - x0), abs(y1 - y0)))
    xs = np.linspace(x0, x1, L).round().astype(int); ys = np.linspace(y0, y1, L).round().astype(int)
    raw = img[ys, xs, 2]  # blue channel: the worst case for saturated blues
    runs, best = 1, 1
    for a, b in zip(raw[:-1], raw[1:]):
        runs = runs + 1 if a == b else 1; best = max(best, runs)
    prof = box[ys, xs]
    step = np.abs(np.diff(prof)).max()
    print(f"line {spec}: lum {prof.min():.1f}..{prof.max():.1f}, longest equal run (B) {best}px, "
          f"max smoothed step {step:.2f}/px, sample {np.round(prof[::max(1, L // 8)], 1).tolist()}")
