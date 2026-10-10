#!/usr/bin/env python3
"""Step 6: motion smoothness from the encoded mp4, frames 270-330 (2 s around 300).

Grain is independent per frame by design, so it is averaged out first (24x24
block means). For smooth drift the frame-to-frame change of those block means is
steady, with a tiny second difference (acceleration); flicker or a popping
element shows as a spike in the second difference.

usage: tools/motion.py <preview.mp4> <name> [strip.png]
"""
import subprocess, sys, os, tempfile
import numpy as np
from PIL import Image

mp4, name = sys.argv[1:3]
strip = sys.argv[3] if len(sys.argv) > 3 else None
d = tempfile.mkdtemp()
sel = "between(n\\,270\\,330)"
subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vf", f"select='{sel}'", "-vsync", "0", os.path.join(d, "%03d.png")], check=True)
fs = [np.asarray(Image.open(os.path.join(d, f)).convert("RGB")).astype(np.float32) for f in sorted(os.listdir(d))]
def blocks(a, b=24):
    h, w, _ = a.shape
    return a[: h // b * b, : w // b * b].reshape(h // b, b, w // b, b, 3).mean(axis=(1, 3))
B = np.stack([blocks(f) for f in fs])
v = np.abs(np.diff(B, axis=0)).mean(axis=(1, 2, 3))           # change per step
acc = np.abs(np.diff(B, 2, axis=0)).mean(axis=(1, 2, 3))      # change of the change
print(f"{name}: block-mean change/step: min {v.min():.3f} mean {v.mean():.3f} max {v.max():.3f}; "
      f"second difference mean {acc.mean():.3f} max {acc.max():.3f}; spike ratio max/mean = {acc.max() / max(acc.mean(), 1e-6):.1f}")
if strip:
    ims = [Image.fromarray(fs[i].astype(np.uint8)).resize((320, 180), Image.LANCZOS) for i in range(30, 38)]
    s = Image.new("RGB", (320 * 4 + 6, 180 * 2 + 2), (40, 40, 40))
    for i, im in enumerate(ims):
        s.paste(im, ((i % 4) * 322, (i // 4) * 182))
    s.save(strip)
