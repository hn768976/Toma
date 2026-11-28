#!/usr/bin/env python3
"""temporal.py - do light, haze and grain stay steady from frame to frame?

Usage: python3 qc/temporal.py video.mp4 [--skip 60-95] [--json out.json]

Per frame (at 480x270): median and p95 luminance (light), p95-p5 contrast of
the outer frame (haze), and the high-pass noise level of the flattest lit
blocks (grain). Reports the largest frame-to-frame step of each, ignoring the
frames given with --skip (an intended flash or whip).
"""
import argparse
import json
import subprocess

import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("video")
ap.add_argument("--skip")
ap.add_argument("--json")
a = ap.parse_args()
W, H = 480, 270
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", a.video, "-vf", f"scale={W}:{H}:flags=area",
                      "-pix_fmt", "gray", "-f", "rawvideo", "-"], capture_output=True).stdout
fr = np.frombuffer(raw, dtype=np.uint8).reshape(-1, H, W).astype(np.float32) / 255
n = len(fr)
p50 = np.percentile(fr.reshape(n, -1), 50, axis=1)
p95 = np.percentile(fr.reshape(n, -1), 95, axis=1)
edge = np.ones((H, W), bool)
edge[H // 4:3 * H // 4, W // 4:3 * W // 4] = False
haze = np.array([np.percentile(f[edge], 95) - np.percentile(f[edge], 5) for f in fr])
# grain: full-resolution luma of a few frames is costly, so use the 480x270
# high-pass (4-neighbour) in the 10% flattest lit 16x16 blocks of each frame
grain = []
for f in fr:
    hp = f[1:-1, 1:-1] - 0.25 * (f[:-2, 1:-1] + f[2:, 1:-1] + f[1:-1, :-2] + f[1:-1, 2:])
    vals = []
    for y in range(0, H - 18, 16):
        for x in range(0, W - 18, 16):
            b = f[y + 1:y + 17, x + 1:x + 17]
            if 0.02 < b.mean() < 0.9:
                vals.append(hp[y:y + 16, x:x + 16].std())
    vals.sort()
    grain.append(np.mean(vals[:max(1, len(vals) // 10)]) * 255 if vals else 0.0)
grain = np.array(grain)
keep = np.ones(n - 1, bool)
if a.skip:
    lo, hi = (int(v) for v in a.skip.split("-"))
    keep[max(0, lo - 1):hi] = False


def step(x):
    d = np.abs(np.diff(x))
    d[~keep] = 0
    return float(d.max()), int(d.argmax() + 1)


res = {"file": a.video, "frames": n, "skipped": a.skip}
for name, x in (("median_luminance", p50), ("p95_luminance", p95), ("edge_contrast_haze", haze), ("grain_level_8bit", grain)):
    s, at = step(x)
    res[name] = {"min": round(float(x.min()), 4), "max": round(float(x.max()), 4),
                 "max_step": round(s, 4), "at_frame": at}
    print(f"{name:22} range {x.min():.4f}-{x.max():.4f}   largest frame-to-frame step {s:.4f} at frame {at}")
if a.json:
    json.dump(res, open(a.json, "w"), indent=1)
