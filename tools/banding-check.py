#!/usr/bin/env python3
"""banding-check.py - step 8.8: view dark / soft-gradient areas with levels stretched x4.

usage: tools/banding-check.py <video.mp4> <frame> <x0,y0,x1,y1 fractions> <out.png>
Crops the region at full resolution, subtracts its darkest level and multiplies by 4
(clipping), so steps in gradients, aliasing and seams become obvious. Also prints the
number of distinct luma levels and the largest step between adjacent used levels.
"""
import subprocess, sys
import numpy as np
from PIL import Image

video, frame, rect, out = sys.argv[1], int(sys.argv[2]), [float(v) for v in sys.argv[3].split(",")], sys.argv[4]
tmp = out + ".src.png"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vf", f"select=eq(n\\,{frame})", "-frames:v", "1", tmp], check=True)
im = Image.open(tmp).convert("RGB")
W, H = im.size
box = (int(rect[0] * W), int(rect[1] * H), int(rect[2] * W), int(rect[3] * H))
crop = np.asarray(im.crop(box)).astype(np.float32)
lo = np.percentile(crop, 1)
stretched = np.clip((crop - lo) * 4.0, 0, 255).astype(np.uint8)
Image.fromarray(stretched).save(out)
luma = (0.2126 * crop[..., 0] + 0.7152 * crop[..., 1] + 0.0722 * crop[..., 2]).round().astype(int)
levels = np.unique(luma)
print(f"{out}: crop {box}, luma range {luma.min()}..{luma.max()}, {len(levels)} levels used, largest gap between used levels {int(np.diff(levels).max()) if len(levels) > 1 else 0}")
