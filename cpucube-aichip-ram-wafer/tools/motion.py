# Motion smoothness around frame 300: mean abs difference between consecutive frames 270..330
# (from the full-render PNG sequence). Judder or flicker shows as spikes / alternation.
import sys
from PIL import Image, ImageChops, ImageStat
d = sys.argv[1]
vals = []
prev = None
for f in range(270, 331):
    im = Image.open(f"{d}/element-{f:03d}.png").convert("L")
    if prev is not None:
        vals.append(ImageStat.Stat(ImageChops.difference(im, prev)).mean[0])
    prev = im
mean = sum(vals) / len(vals)
mx, mn = max(vals), min(vals)
# alternation (flicker) measure: mean |v[i] - (v[i-1]+v[i+1])/2|
alt = sum(abs(vals[i] - (vals[i - 1] + vals[i + 1]) / 2) for i in range(1, len(vals) - 1)) / (len(vals) - 2)
print(f"{d.split('/')[-1]}: mean frame diff {mean:.3f}  min {mn:.3f}  max {mx:.3f}  max/mean {mx/mean:.2f}  alternation {alt:.3f}")
