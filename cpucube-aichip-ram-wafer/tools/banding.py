# Banding check on a frame decoded from the encoded mp4.
# usage: python3 tools/banding.py frame.png x0 y0 x1 y1 [label]
# Reads a line profile from (x0,y0) to (x1,y1) (averaged over a 9-px wide strip),
# prints sampled values and step statistics. Banding shows as flat plateaus joined by
# 1-code jumps; a smooth gradient with grain shows small, irregular differences.
import sys, math
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB"); W, H = im.size
x0, y0, x1, y1 = map(int, sys.argv[2:6]); label = sys.argv[6] if len(sys.argv) > 6 else ""
px = im.load()
n = int(math.hypot(x1 - x0, y1 - y0))
dx, dy = (x1 - x0) / n, (y1 - y0) / n
nx, ny = -dy, dx
prof = []
for i in range(n):
    acc = [0, 0, 0]; c = 0
    for k in range(-4, 5):
        x = int(x0 + dx * i + nx * k); y = int(y0 + dy * i + ny * k)
        if 0 <= x < W and 0 <= y < H:
            p = px[x, y]; acc = [acc[j] + p[j] for j in range(3)]; c += 1
    prof.append(tuple(a / c for a in acc))
lum = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in prof]
# block means (16 px) to see the underlying gradient
blk = [sum(lum[i:i + 16]) / len(lum[i:i + 16]) for i in range(0, n, 16)]
d = [abs(blk[i + 1] - blk[i]) for i in range(len(blk) - 1)]
# plateau detector: longest run where the 9-px-averaged luma stays within 0.25 of a value
# while the overall gradient over the strip is > 3 codes
longest = 0; run = 1
for i in range(1, n):
    if abs(lum[i] - lum[i - 1]) < 0.05: run += 1; longest = max(longest, run)
    else: run = 1
span = max(blk) - min(blk)
print(f"{label}: n={n}px luma {min(lum):.1f}..{max(lum):.1f} span(blocks)={span:.1f}  max block step={max(d) if d else 0:.2f}  "
      f"longest exact-flat run={longest}px")
print("  block luma:", " ".join(f"{v:.1f}" for v in blk))
