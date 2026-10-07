#!/usr/bin/env python3
"""Five evenly spaced frames of a video in a row.  usage: contact_sheet.py video.mp4 out.png [n=5]"""
import subprocess, sys, tempfile, os
from PIL import Image
video, out = sys.argv[1], sys.argv[2]
n = int(sys.argv[3]) if len(sys.argv) > 3 else 5
frames = [int(i * 600 / n) + 12 for i in range(n)]  # evenly spaced across the 600 frames
tmp = tempfile.mkdtemp()
ims = []
for i, f in enumerate(frames):
    p = os.path.join(tmp, f"{i}.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vf", f"select=eq(n\\,{f}),scale=512:288", "-frames:v", "1", p], check=True)
    ims.append(Image.open(p).convert("RGB"))
w, h = ims[0].size
sheet = Image.new("RGB", (w * n + 4 * (n - 1), h), (50, 50, 50))
for i, im in enumerate(ims):
    sheet.paste(im, (i * (w + 4), 0))
sheet.save(out)
print("frames:", frames)
