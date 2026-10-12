#!/usr/bin/env python3
"""Step 6: motion smoothness around frame 300 (frames 270..330, 2 s).

Uses the full-render PNG frames. For each consecutive pair computes the mean
absolute difference; stepping/stutter shows up as an irregular sequence (a
frame with ~0 change next to a big one). Also writes 2 s strips of 100% crops
for visual inspection.
usage: python3 -I scripts/motion-check.py <compositionId>
"""
import sys, json, os
import numpy as np
from PIL import Image
ID = sys.argv[1]
fr = f"out/frames/{ID}"
ims = [np.asarray(Image.open(f"{fr}/element-{i:03d}.png").convert("RGB")).astype(np.int16) for i in range(270, 331)]
d = [float(np.abs(ims[i + 1] - ims[i]).mean()) for i in range(len(ims) - 1)]
d = np.array(d)
res = {"id": ID, "mean_step": round(float(d.mean()), 3), "min_step": round(float(d.min()), 3),
       "max_step": round(float(d.max()), 3), "cv": round(float(d.std() / d.mean()), 3)}
# zero-motion frames between moving ones would indicate stepping
res["stalls"] = int(np.sum(d < 0.15 * d.mean()))
os.makedirs("out/motion", exist_ok=True)
H, W, _ = ims[0].shape
crop = lambda im: im[H // 2 - 90:H // 2 + 90, W // 2 - 160:W // 2 + 160]
strip = np.concatenate([np.concatenate([crop(ims[i]) for i in range(r, r + 6)], 1) for r in (0, 30, 54)], 0)
Image.fromarray(strip.clip(0, 255).astype(np.uint8)).save(f"out/motion/{ID}.png")
print(json.dumps(res))
