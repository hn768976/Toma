"""Step 6: frame-to-frame change of an mp4 over a frame range (default 285-345,
i.e. 2 s around frame 300). Grain is removed with a box blur first, so the
numbers track real motion. Smooth animation gives a flat series; a pop, jump or
flicker shows up as a spike (max/median well above 1).

usage: python3 scripts/motion.py file.mp4 [first last]
"""
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFilter

path = sys.argv[1]
first = int(sys.argv[2]) if len(sys.argv) > 2 else 285
last = int(sys.argv[3]) if len(sys.argv) > 3 else 345

proc = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-i", path, "-vf", f"select='between(n,{first},{last})'",
     "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    stdout=subprocess.PIPE)
size = 720 * 1280 * 3
prev = None
diffs = []
while True:
    buf = proc.stdout.read(size)
    if len(buf) < size:
        break
    f = np.asarray(Image.frombuffer("RGB", (1280, 720), buf).filter(ImageFilter.BoxBlur(4)), np.float32)
    if prev is not None:
        diffs.append(np.abs(f - prev).mean())
    prev = f
proc.wait()
d = np.array(diffs)
med = np.median(d)
worst = int(np.argmax(d)) + first
print(f"{len(d) + 1} frames  diff median {med:.3f}  min {d.min():.3f}  max {d.max():.3f} "
      f"(at {worst}->{worst + 1})  max/median {d.max() / med:.2f}  std/median {d.std() / med:.2f}")
