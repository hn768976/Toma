#!/usr/bin/env python3
"""Tiles the 16 review stills (1280x720) into StillsSheet.png, 4 x 4 with labels."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

d = Path(sys.argv[1])
files = sorted(p for p in d.glob("S*.png"))
W, H, PAD, LAB = 1280, 720, 16, 44
cols = 4
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (W + PAD) + PAD, rows * (H + LAB + PAD) + PAD), (255, 255, 255))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("DejaVuSans.ttf", 28)
except OSError:
    font = ImageFont.load_default()
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB")
    assert im.size == (W, H), (f, im.size)
    x = PAD + (i % cols) * (W + PAD)
    y = PAD + (i // cols) * (H + LAB + PAD)
    sheet.paste(im, (x, y + LAB))
    draw.text((x, y + 6), f.stem, fill=(40, 40, 40), font=font)
out = d.parent / "StillsSheet.png"
sheet.save(out, optimize=True)
print(out, sheet.size)
