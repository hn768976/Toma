#!/usr/bin/env python3
"""Compare two images pixel for pixel. Prints identical/max diff."""
import sys
import numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(int)
b = np.asarray(Image.open(sys.argv[2]).convert('RGB')).astype(int)
if a.shape != b.shape:
    print('SHAPE MISMATCH', a.shape, b.shape); sys.exit(1)
d = np.abs(a - b)
print(('IDENTICAL' if d.max() == 0 else 'DIFFERENT') + f' max={d.max()} differing_px={(d.max(axis=2) > 0).sum()}')
sys.exit(0 if d.max() == 0 else 1)
