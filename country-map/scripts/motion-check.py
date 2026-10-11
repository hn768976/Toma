"""Motion smoothness check on a frame sequence (sorted PNGs in a directory).
Phase correlation on the sharp band gives the per-frame image shift (judder =
irregular shifts). After compensating the shift, the residual on the sharp band
measures shimmer/crawl of thin lines.
  python3 scripts/motion-check.py DIR [first_index_in_dir] [count]
"""
import sys, glob
import numpy as np
from PIL import Image

def nd_shift(img, sh, order=None, mode=None):
    # Sub-pixel translation via the Fourier shift theorem (numpy only).
    dy, dx = sh
    fy = np.fft.fftfreq(img.shape[0])[:, None]; fx = np.fft.fftfreq(img.shape[1])[None, :]
    return np.fft.ifft2(np.fft.fft2(img) * np.exp(-2j * np.pi * (fy * dy + fx * dx))).real

files = sorted(glob.glob(sys.argv[1] + '/*.png'))
a = int(sys.argv[2]) if len(sys.argv) > 2 else 0
n = int(sys.argv[3]) if len(sys.argv) > 3 else len(files)
files = files[a:a + n]
def band(f):
    g = np.asarray(Image.open(f).convert('L'), dtype=float)
    return g[300:440, 160:1120]
win = np.outer(np.hanning(140), np.hanning(960))
def phase(a, b):
    A = np.fft.fft2(a * win); B = np.fft.fft2(b * win)
    R = A * np.conj(B); R /= np.abs(R) + 1e-9
    r = np.fft.ifft2(R).real
    y, x = np.unravel_index(np.argmax(r), r.shape)
    # subpixel via parabola
    def sub(c, m, p):
        d = (m - p) / (2 * (m - 2 * c + p) + 1e-12); return d
    dy = sub(r[y, x], r[(y - 1) % r.shape[0], x], r[(y + 1) % r.shape[0], x])
    dx = sub(r[y, x], r[y, (x - 1) % r.shape[1]], r[y, (x + 1) % r.shape[1]])
    y = y + dy; x = x + dx
    if y > r.shape[0] / 2: y -= r.shape[0]
    if x > r.shape[1] / 2: x -= r.shape[1]
    return x, y
prev = band(files[0]); shifts = []; resid = []
for f in files[1:]:
    cur = band(f)
    dx, dy = phase(cur, prev)
    shifts.append((dx, dy))
    comp = nd_shift(prev, (dy, dx), order=3, mode='nearest')
    resid.append(np.abs(cur - comp)[10:-10, 10:-10].mean())
    prev = cur
s = np.array(shifts)
acc = np.diff(s, axis=0)
print(f'frames {len(files)}  mean shift/frame dx={s[:,0].mean():+.3f}px dy={s[:,1].mean():+.3f}px')
print(f'  shift range dx [{s[:,0].min():+.3f},{s[:,0].max():+.3f}]  frame-to-frame change (judder) max |d(dx)|={np.abs(acc[:,0]).max():.3f}px  std={acc[:,0].std():.3f}px')
print(f'  motion-compensated residual on sharp band: mean {np.mean(resid):.2f}  max {np.max(resid):.2f} (grain floor ~1.5-3)')
