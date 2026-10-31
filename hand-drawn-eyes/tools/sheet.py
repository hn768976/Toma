#!/usr/bin/env python3
"""Contact sheet of consecutive PNG-sequence frames.
usage: sheet.py <seq_dir> <start> <count> <x0,y0,x1,y1> <out.png> [cols]"""
import sys
from PIL import Image, ImageDraw
d, start, n, box, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
cols = int(sys.argv[6]) if len(sys.argv) > 6 else 4
x0, y0, x1, y1 = map(int, box.split(","))
tw = 470
th = int((y1 - y0) * tw / (x1 - x0))
rows = (n + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * th), (40, 40, 40))
for i in range(n):
    f = start + i
    im = Image.open(f"{d}/element-{f % 300:03d}.png").convert("RGB").crop((x0, y0, x1, y1)).resize((tw, th))
    ImageDraw.Draw(im).text((5, 5), str(f), fill=(255, 255, 0))
    sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
sheet.save(out)
