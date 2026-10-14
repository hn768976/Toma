#!/usr/bin/env python3
"""Step 4 — banding check on frames decoded from the ENCODED mp4.

For each named region (a horizontal and a vertical strip through a dark or
blurred gradient area) it reads the luma values, then reports:
  * longest run of identical raw values (a flat 8-bit plateau = band)
  * the 15-px moving-average profile and its largest single-step jump
Smooth gradients with grain/dither give short runs (< ~6 px) and no jumps
> 1.5 levels in the averaged profile.
usage: banding.py video.mp4 time_s "name:x0,y0,x1,y1" ...
"""
import subprocess, sys

def frame_luma(path, t):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", path, "-frames:v", "1",
                          "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True, check=True).stdout
    w, h = 1280, 720
    assert len(raw) == w * h, len(raw)
    return [raw[y * w:(y + 1) * w] for y in range(h)]

def line(img, x0, y0, x1, y1):
    n = max(abs(x1 - x0), abs(y1 - y0)) + 1
    return [img[round(y0 + (y1 - y0) * i / (n - 1))][round(x0 + (x1 - x0) * i / (n - 1))] for i in range(n)]

def longest_run(v):
    best = cur = 1
    for a, b in zip(v, v[1:]):
        cur = cur + 1 if a == b else 1
        best = max(best, cur)
    return best

def smooth(v, k=15):
    h = k // 2
    return [sum(v[max(0, i - h):i + h + 1]) / len(v[max(0, i - h):i + h + 1]) for i in range(len(v))]

path, t = sys.argv[1], float(sys.argv[2])
img = frame_luma(path, t)
ok = True
for spec in sys.argv[3:]:
    name, coords = spec.split(":")
    x0, y0, x1, y1 = map(int, coords.split(","))
    v = line(img, x0, y0, x1, y1)
    s = smooth(v)
    jump = max(abs(a - b) for a, b in zip(s, s[1:]))
    run = longest_run(v)
    verdict = "SMOOTH" if run <= 8 and jump <= 1.5 else "CHECK"
    ok &= verdict == "SMOOTH"
    sample = " ".join(str(x) for x in v[:: max(1, len(v) // 16)])
    print(f"  {name:<26} len={len(v):4d} luma {min(v):3d}..{max(v):3d}  longest flat run={run:2d}px  max avg step={jump:.2f}  {verdict}\n      samples: {sample}")
sys.exit(0 if ok else 1)
