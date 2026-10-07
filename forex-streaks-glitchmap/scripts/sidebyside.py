#!/usr/bin/env python3
"""Put a reference frame and a preview frame side by side (both scaled to 768x432).
usage: sidebyside.py ref.png mine.png out.png"""
import sys
from PIL import Image
ref, mine, out = sys.argv[1:4]
a = Image.open(ref).convert("RGB").resize((768, 432), Image.LANCZOS)
b = Image.open(mine).convert("RGB").resize((768, 432), Image.LANCZOS)
im = Image.new("RGB", (768 * 2 + 8, 432), (40, 40, 40))
im.paste(a, (0, 0)); im.paste(b, (776, 0))
im.save(out)
