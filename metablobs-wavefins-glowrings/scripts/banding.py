"""Banding check on a frame decoded from the encoded mp4.

usage: python3 scripts/banding.py frame.png kind out_stretch.png
kind: rings | white | neon | fins

Prints a pixel profile (strip-averaged across 9 px to look past grain) and the
largest 1-px jump in that averaged profile, and writes a contrast-stretched copy
of the frame so any steps/rings become obvious to the eye.
"""
import sys
import numpy as np
from PIL import Image

path, kind, out = sys.argv[1:4]
img = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
H, W, _ = img.shape

def strip_v(x):  # vertical profile at column x, averaged over 9 columns
    return img[:, x - 4:x + 5, :].mean(axis=1)

def strip_h(y):
    return img[y - 4:y + 5, :, :].mean(axis=0)

if kind == "rings":
    prof = strip_v(W // 2)
    lo, hi = 0, 70
elif kind == "white":
    # pick the row whose values stay closest to the background (fewest blob pixels)
    lum = img.mean(axis=2)
    best = min(range(10, H - 10, 10), key=lambda y: np.abs(lum[y] - np.median(lum)).mean())
    prof = strip_h(best)
    print(f"row {best}")
    lo, hi = 200, 255
elif kind == "neon":
    # row through the brightest blob, profile from its edge outward into black
    lum = img.mean(axis=2)
    y = int(np.argmax(lum.mean(axis=1)))
    prof = strip_h(y)
    print(f"row {y}")
    lo, hi = 0, 80
else:  # fins: dark gaps
    prof = strip_h(H // 2)
    lo, hi = 0, 30

l = prof.mean(axis=1)
step = np.abs(np.diff(l))
print("profile (every 16 px, R G B):")
for i in range(0, len(prof), 16):
    r, g, b = prof[i]
    print(f"  {i:4d}: {r:6.1f} {g:6.1f} {b:6.1f}")
print(f"max 1-px jump in 9-px-averaged luminance: {step.max():.2f}  (median {np.median(step):.2f})")
if kind == "fins":
    dark = img.mean(axis=2) < 8
    print(f"pixels below 8/255: {dark.mean() * 100:.1f}%  "
          f"mean/max inside those: {img.mean(axis=2)[dark].mean():.2f} / {img.mean(axis=2)[dark].max():.0f}")
st = np.clip((img - lo) / (hi - lo) * 255, 0, 255).astype(np.uint8)
Image.fromarray(st).save(out)
