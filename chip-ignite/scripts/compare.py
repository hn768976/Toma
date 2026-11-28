#!/usr/bin/env python3
"""compare.py - side-by-side image: reference | ours | difference.

Usage: python3 scripts/compare.py reference.png ours.png out.png [--size 960x540]

The difference panel is |reference - ours| per channel, amplified x2.
"""
import argparse

import numpy as np
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument("ref")
ap.add_argument("ours")
ap.add_argument("out")
ap.add_argument("--size", default="960x540")
a = ap.parse_args()
w, h = (int(v) for v in a.size.split("x"))
ref = Image.open(a.ref).convert("RGB").resize((w, h), Image.LANCZOS)
ours = Image.open(a.ours).convert("RGB").resize((w, h), Image.LANCZOS)
d = np.abs(np.asarray(ref, dtype=np.int16) - np.asarray(ours, dtype=np.int16))
diff = Image.fromarray(np.clip(d * 2, 0, 255).astype(np.uint8))
sheet = Image.new("RGB", (w * 3 + 16, h + 28), (24, 24, 24))
for i, (im, label) in enumerate(((ref, "reference"), (ours, "ours"), (diff, "difference x2"))):
    sheet.paste(im, (i * (w + 8), 28))
    ImageDraw.Draw(sheet).text((i * (w + 8) + 6, 8), label, fill=(220, 220, 220))
sheet.save(a.out)
print("wrote", a.out)
