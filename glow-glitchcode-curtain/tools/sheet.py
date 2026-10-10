#!/usr/bin/env python3
"""Contact sheet: tools/sheet.py out.png in1.png in2.png ... (one row, 5 frames)."""
import sys
from PIL import Image
out, ins = sys.argv[1], sys.argv[2:]
ims = [Image.open(p).convert("RGB") for p in ins]
tw = 512
th = round(tw * ims[0].height / ims[0].width)
sheet = Image.new("RGB", (tw * len(ims) + 4 * (len(ims) - 1), th), (40, 40, 40))
for i, im in enumerate(ims):
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (i * (tw + 4), 0))
sheet.save(out)
