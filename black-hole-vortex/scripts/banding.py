# Step 4: banding check on a frame decoded from the encoded mp4.
# Samples luma along a line through a glow falloff into the dark background,
# averaged over a 9-px band perpendicular to the line. Banding shows up as
# long flat runs separated by jumps; smooth falloff has small, even steps.
import sys, subprocess, io
import numpy as np
from PIL import Image
mp4, x0, y0, x1, y1 = sys.argv[1], *map(int, sys.argv[2:6])
png = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vf", "select=eq(n\\,300)", "-frames:v", "1",
                      "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True).stdout
im = np.asarray(Image.open(io.BytesIO(png)).convert("L")).astype(float)
n = int(np.hypot(x1 - x0, y1 - y0))
xs = np.linspace(x0, x1, n); ys = np.linspace(y0, y1, n)
dx, dy = (y1 - y0) / n, -(x1 - x0) / n
prof = np.mean([im[np.clip((ys + k * dy).astype(int), 0, im.shape[0] - 1),
                   np.clip((xs + k * dx).astype(int), 0, im.shape[1] - 1)] for k in range(-4, 5)], axis=0)
# smooth along the line over 9 px (grain) then look at the local slope
k = 9
sm = np.convolve(prof, np.ones(k) / k, mode="valid")
d = np.diff(sm)
raw = im[ys.astype(int), xs.astype(int)]
flat = max((len(list(g)) for v, g in __import__("itertools").groupby(np.round(raw))), default=0)
print(f"{mp4.split('/')[-1]:28s} range {sm.min():5.1f}..{sm.max():5.1f}  max|step| {np.abs(d).max():.2f}  "
      f"mean|step| {np.abs(d).mean():.2f}  longest identical raw run {flat}px")
print("   samples:", " ".join(f"{v:.0f}" for v in sm[:: max(1, len(sm) // 16)]))
