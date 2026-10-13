#!/usr/bin/env python3
"""Contrast-stretch a crop (x0,y0,x1,y1 fractions) x8 around its mean so any
8-bit banding steps become obvious. usage: stretch.py in.png out.png x0 y0 x1 y1"""
import sys
import numpy as np
from PIL import Image
im = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float64)
H, W, _ = im.shape
x0, y0, x1, y1 = [float(v) for v in sys.argv[3:7]]
c = im[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)]
g = c.mean(axis=2)
g = (g - g.mean()) * 8 + 128
Image.fromarray(np.clip(g, 0, 255).astype(np.uint8)).save(sys.argv[2])
