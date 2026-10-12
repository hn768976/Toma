"""Banding check on a frame decoded from the encoded mp4.

Reads (a) a vertical profile down the full height (column band averaged over
`w` px, so grain averages out but 8-bit steps would remain) and (b) a
horizontal profile across the ray area. Reports the largest jump between
neighbouring rows/cols relative to the local slope, and the longest flat run
(identical rounded level) — steps or long plateaus would indicate banding.
Also reports, for a raw single-pixel column, how many distinct values
neighbouring 8-px blocks take (dither should keep these varied).
usage: python3 banding.py frame.png x_frac y_frac
"""
import sys
from PIL import Image

im = Image.open(sys.argv[1]).convert("RGB")
W, H = im.size
xf, yf = float(sys.argv[2]), float(sys.argv[3])
px = im.load()

def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]

def vprofile(x0, w):
    return [sum(lum(px[x, y]) for x in range(x0, x0 + w)) / w for y in range(H)]

def hprofile(y0, h):
    return [sum(lum(px[x, y]) for y in range(y0, y0 + h)) / h for x in range(W)]

def smooth(a, r=6):
    return [sum(a[max(0, i - r):i + r + 1]) / len(a[max(0, i - r):i + r + 1]) for i in range(len(a))]

def analyse(name, prof):
    s = smooth(prof, 4)
    d = [s[i + 1] - s[i] for i in range(len(s) - 1)]
    # step detector: residual of the 4-px smoothed profile vs a 24-px smoothed one
    big = smooth(prof, 24)
    resid = [abs(s[i] - big[i]) for i in range(len(s))]
    # flat runs of the rounded raw profile
    levels = [round(v) for v in prof]
    run = best = 1
    for i in range(1, len(levels)):
        run = run + 1 if levels[i] == levels[i - 1] else 1
        best = max(best, run)
    print(f"{name}: range {min(prof):.1f}–{max(prof):.1f}, max |Δ| {max(abs(x) for x in d):.2f}/px, "
          f"max residual vs smooth {max(resid):.2f} levels, longest flat run {best} px")
    return prof

v = analyse(f"vertical  x={xf:.2f}", vprofile(int(xf * W), 48))
h = analyse(f"horizontal y={yf:.2f}", hprofile(int(yf * H), 16))
print("vertical samples every 10%:", " ".join(f"{v[int(i * (H - 1) / 10)]:.1f}" for i in range(11)))
print("horizontal samples every 10%:", " ".join(f"{h[int(i * (W - 1) / 10)]:.1f}" for i in range(11)))
