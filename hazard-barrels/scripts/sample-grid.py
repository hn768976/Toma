#!/usr/bin/env python3
"""Print mean colour of a coarse grid of cells for a reference frame and an attempt (debug aid)."""
import sys
import numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert("RGB").resize((898, 506), Image.BOX)).astype(float)
b = np.asarray(Image.open(sys.argv[2]).convert("RGB").resize((898, 506), Image.BOX)).astype(float)
cols, rows = int(sys.argv[3]) if len(sys.argv) > 3 else 9, int(sys.argv[4]) if len(sys.argv) > 4 else 4
for j in range(rows):
    line = ""
    for i in range(cols):
        y0, y1 = j * 506 // rows, (j + 1) * 506 // rows
        x0, x1 = i * 898 // cols, (i + 1) * 898 // cols
        ca, cb = a[y0:y1, x0:x1].reshape(-1, 3).mean(0), b[y0:y1, x0:x1].reshape(-1, 3).mean(0)
        line += "%02x%02x%02x/%02x%02x%02x  " % (*[int(v) for v in ca], *[int(v) for v in cb])
    print(line)
