#!/usr/bin/env python3
"""Step 4: banding check on an ENCODED mp4 (not a preview).
Extracts a frame, then reads pixel values along lines through the glows, the flare/haze and the sky
gradient. Because grain/dither make single-pixel neighbours noisy, each profile is box-averaged over
a window of AVG pixels perpendicular to the line and along it; banding shows up as steps in that
smoothed profile. We report, per line, the largest step between adjacent smoothed samples (8-bit
levels). The verdict uses the longest flat plateau of a single channel on a profile averaged 41 px
perpendicular to the line (grain/dither average out; a staircase does not): >= 12 px is flagged.
usage: banding.py video.mp4 composition-kind frame out_prefix
  kind: board | streaks | map
"""
import subprocess, sys
import numpy as np
from PIL import Image

video, kind, frame, prefix = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
png = f"{prefix}.frame{frame}.png"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vf", f"select=eq(n\\,{frame})", "-frames:v", "1", png], check=True)
img = np.asarray(Image.open(png).convert("RGB")).astype(float)
H, W, _ = img.shape

# (name, (x0,y0), (x1,y1)) in fractions of the frame; sampled along the segment
LINES = {
    "board": [
        ("red glow, lower-left: along the bottom, left->right", (0.00, 0.97), (0.55, 0.97)),
        ("red glow, lower-left: up the left edge", (0.03, 1.00), (0.03, 0.55)),
        ("blue glow, upper-right: along the top", (0.55, 0.03), (1.00, 0.03)),
        ("blue glow, upper-right: down the right edge", (0.985, 0.0), (0.985, 0.45)),
    ],
    "streaks": [
        ("sky gradient: up the left side", (0.10, 0.40), (0.10, 0.02)),
        ("sky gradient: up the middle", (0.45, 0.40), (0.45, 0.02)),
        ("haze above the flare", (0.93, 0.40), (0.93, 0.02)),
        ("horizon haze: across the sky", (0.05, 0.30), (0.98, 0.30)),
    ],
    "map": [
        ("sea (should be black, grain only)", (0.05, 0.60), (0.20, 0.60)),
    ],
}[kind]

AVG, RUN, FLAG_RUN = 9, 6, 12
PERP = 41  # perpendicular averaging for the plateau metric
report = []
for name, (ax, ay), (bx, by) in LINES:
    n = int(max(abs(bx - ax) * W, abs(by - ay) * H))
    xs = np.linspace(ax * (W - 1), bx * (W - 1), n)
    ys = np.linspace(ay * (H - 1), by * (H - 1), n)
    # perpendicular box average (AVG px) over every channel
    dx, dy = (bx - ax) * W, (by - ay) * H
    L = (dx * dx + dy * dy) ** 0.5 or 1
    px, py = -dy / L, dx / L
    acc = np.zeros((n, 3))
    for k in range(-(AVG // 2), AVG // 2 + 1):
        xi = np.clip(np.round(xs + px * k).astype(int), 0, W - 1)
        yi = np.clip(np.round(ys + py * k).astype(int), 0, H - 1)
        acc += img[yi, xi]
    acc /= AVG
    # smooth along the line
    ker = np.ones(AVG) / AVG
    sm = np.stack([np.convolve(acc[:, c], ker, mode="valid") for c in range(3)], axis=1)
    lum = sm @ np.array([0.2126, 0.7152, 0.0722])
    steps = np.abs(np.diff(sm, axis=0)).max(axis=1)
    # stair events: >=RUN near-flat samples then a jump
    stairs = 0
    flat = 0
    for s in steps:
        if s < 0.25:
            flat += 1
        else:
            if flat >= RUN and s >= 2.0:
                stairs += 1
            flat = 0
    # Plateau metric: average PERP px perpendicular to the line (grain and dither average out and
    # leave the true ramp), then find the longest flat plateau of a single channel. A quantised,
    # un-dithered gradient is a staircase: plateaus of many px. A dithered one is a smooth ramp.
    accp = np.zeros((n, 3))
    for k in range(-(PERP // 2), PERP // 2 + 1):
        xi = np.clip(np.round(xs + px * k).astype(int), 0, W - 1)
        yi = np.clip(np.round(ys + py * k).astype(int), 0, H - 1)
        accp += img[yi, xi]
    accp /= PERP
    longest = 0
    for c in range(3):
        v = accp[:, c]
        run = 1
        for k in range(1, n):
            if abs(v[k] - v[k - 1]) < 0.02 and v[k] > 8:
                run += 1
                longest = max(longest, run)
            else:
                run = 1
    report.append((name, lum.min(), lum.max(), steps.max(), float(np.percentile(steps, 95)), longest))

print(f"banding check: {video} frame {frame}  ({W}x{H}, smoothing window {AVG}px)")
bad = 0
for name, lo, hi, mx, p95, longest in report:
    verdict = "OK   " if longest < FLAG_RUN else "BANDS"
    bad += longest >= FLAG_RUN
    print(f"  [{verdict}] {name}: luma {lo:5.1f}..{hi:5.1f}  longest flat plateau {longest:2d} px  (smoothed max step {mx:4.2f}, p95 {p95:4.2f})")
sys.exit(1 if bad else 0)
