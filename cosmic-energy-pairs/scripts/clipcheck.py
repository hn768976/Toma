import sys, numpy as np
from PIL import Image
for f in sys.argv[1:]:
    a = np.asarray(Image.open(f).convert('RGB')).astype(int)
    m = a.max(axis=2)
    h, w = m.shape
    cy, cx = np.unravel_index(np.argmax(np.convolve(m.ravel(), np.ones(1), 'same').reshape(h, w)), m.shape)
    print(f, f"px>=254: {(m >= 254).sum()} ({(m >= 254).mean()*100:.3f}%), px==255: {(m == 255).sum()}",
          "row through brightest:", m[cy, max(0, cx-60):cx+61:6].tolist())
