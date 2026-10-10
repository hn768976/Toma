#!/usr/bin/env python3
"""Contact sheet: five evenly spaced frames in a row.  usage: contact.py <mp4> <out.png> [n=5] [tile_w=384]"""
import subprocess, sys, tempfile, os
from PIL import Image
mp4, out = sys.argv[1], sys.argv[2]
n = int(sys.argv[3]) if len(sys.argv) > 3 else 5
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 384
frames = [round(i * 599 / (n - 1)) for i in range(n)] if n > 1 else [300]
# 5 evenly spaced across the loop (0..~600): 0,120,240,360,480
frames = [round(i * 600 / n) for i in range(n)]
tiles = []
with tempfile.TemporaryDirectory() as d:
    for f in frames:
        p = os.path.join(d, f"{f}.png")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", f"select=eq(n\\,{f})", "-frames:v", "1", p], check=True)
        im = Image.open(p).convert("RGB")
        th = round(tw * im.height / im.width)
        tiles.append(im.resize((tw, th), Image.LANCZOS))
sheet = Image.new("RGB", (tw * n, tiles[0].height))
for i, t in enumerate(tiles):
    sheet.paste(t, (i * tw, 0))
sheet.save(out)
print("frames", frames, "->", out)
