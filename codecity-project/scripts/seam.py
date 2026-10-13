import sys
from PIL import Image, ImageChops, ImageStat
# usage: seam.py prefix  (expects prefix_597.png ... prefix_599.png, prefix_0.png, prefix_1.png)
p = sys.argv[1]
fr = [597, 598, 599, 0, 1]
ims = [Image.open(f"{p}_{f}.png").convert("RGB") for f in fr]
for a, b, fa, fb in zip(ims, ims[1:], fr, fr[1:]):
    d = ImageStat.Stat(ImageChops.difference(a, b)).mean
    print(f"{fa:>3}->{fb:<3} mean|diff| = {sum(d)/3:.3f}")
