#!/usr/bin/env python3
"""scan-frames.py VIDEO [--json out.json]
Decodes every frame (via ffmpeg, 320x180 grey) and reports: frame count, mean
brightness range, near-black frames, frozen runs (identical consecutive frames)
and the largest frame-to-frame brightness jump (flicker)."""
import json
import subprocess
import sys

import numpy as np

path = sys.argv[1]
W, H = 320, 180
raw = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}", "-pix_fmt", "gray", "-f", "rawvideo", "-"],
    check=True, capture_output=True).stdout
n = len(raw) // (W * H)
fr = np.frombuffer(raw, np.uint8).reshape(n, H, W).astype(np.float32)
mean = fr.mean(axis=(1, 2))
diff = np.abs(fr[1:] - fr[:-1]).mean(axis=(1, 2))
jump = np.abs(mean[1:] - mean[:-1])
frozen = diff < 0.02
runs = []
start = None
for i, f in enumerate(frozen):
    if f and start is None:
        start = i
    if not f and start is not None:
        if i - start >= 3:
            runs.append([int(start), int(i)])
        start = None
if start is not None and len(frozen) - start >= 3:
    runs.append([int(start), int(len(frozen))])
out = {
    "frames": int(n),
    "mean_min": float(mean.min()), "mean_max": float(mean.max()),
    "near_black_frames": [int(i) for i in np.where(mean < 3)[0]],
    "frozen_runs_first_last_frame": runs,
    "max_brightness_jump": float(jump.max()), "max_brightness_jump_at": int(jump.argmax()) + 1,
    "max_frame_diff": float(diff.max()), "max_frame_diff_at": int(diff.argmax()) + 1,
    "median_frame_diff": float(np.median(diff)),
}
print(json.dumps(out, indent=1))
if "--json" in sys.argv:
    json.dump(out, open(sys.argv[sys.argv.index("--json") + 1], "w"), indent=1)
